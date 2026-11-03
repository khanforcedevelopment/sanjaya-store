-- Phase 16: identity verification by document upload and Super Admin review.
-- Aadhaar is not collected: only licensed e-KYC providers may process Aadhaar numbers.

alter table public.kyc_applications
  add column if not exists document_last4 text check (document_last4 ~ '^[A-Z0-9]{4}$'),
  add column if not exists document_paths text[] not null default '{}',
  add column if not exists consent_at timestamptz;

update public.site_settings set value = value || jsonb_build_object('provider', 'manual') where key = 'kyc';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc-documents', 'kyc-documents', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

-- customers upload only into their own folder and cannot read files back; only the Super Admin can view them
create policy "customer uploads own kyc files" on storage.objects for insert
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "super admin reads kyc files" on storage.objects for select
  using (bucket_id = 'kyc-documents' and public.has_role('super_admin'));

-- Called by the kyc-submit server function after it has hashed the document number.
create or replace function public.register_manual_kyc(
  p_user uuid, p_document_type text, p_document_number_hash text, p_document_last4 text,
  p_name_on_document text, p_paths text[]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status kyc_status; v_flags text[] := '{}'; v_reasons text[] := '{}'; p text;
begin
  if not is_service_role() then raise exception 'Server only' using errcode = '42501'; end if;
  if p_document_type not in ('pan', 'passport', 'driving_licence', 'voter_id') then raise exception 'Unsupported document type'; end if;
  if cardinality(p_paths) < 2 or cardinality(p_paths) > 3 then raise exception 'Upload the ID photo and a selfie'; end if;
  foreach p in array p_paths loop
    if split_part(p, '/', 1) <> p_user::text then raise exception 'Invalid file'; end if;
  end loop;
  perform 1 from profiles where id = p_user for update;
  if exists (select 1 from kyc_applications where user_id = p_user and status = 'approved') then raise exception 'Your identity is already verified'; end if;
  if exists (select 1 from kyc_applications where user_id = p_user and status in ('pending', 'manual_review')) then
    raise exception 'Your documents are already being reviewed';
  end if;
  if (select count(*) from kyc_applications where user_id = p_user and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Too many attempts today. Please try again tomorrow.';
  end if;

  if exists (select 1 from kyc_applications k where k.document_number_hash = p_document_number_hash and k.user_id <> p_user
             and k.status in ('approved', 'pending', 'manual_review')) then
    v_flags := array['duplicate_identity'];
    v_reasons := array['This ID is already linked to another account'];
    v_status := 'rejected';
  else
    v_status := 'manual_review';
  end if;

  insert into kyc_applications (user_id, status, provider, document_type, document_number_hash, document_last4, name_on_document,
                                document_paths, risk_flags, decision_reasons, consent_at, decided_at)
  values (p_user, v_status, 'manual', p_document_type, p_document_number_hash, p_document_last4, left(trim(p_name_on_document), 120),
          p_paths, v_flags, v_reasons, now(), case when v_status = 'rejected' then now() end)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', v_status, 'reasons', to_jsonb(v_reasons));
end $$;
revoke execute on function public.register_manual_kyc(uuid, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.register_manual_kyc(uuid, text, text, text, text, text[]) to service_role;
