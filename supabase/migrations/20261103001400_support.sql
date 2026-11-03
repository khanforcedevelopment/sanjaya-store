-- Phase 17: keep ticket status in step with the conversation.
create or replace function public.on_support_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update support_tickets
     set status = case when not new.is_staff then 'open' when status = 'resolved' then 'resolved' else 'pending_customer' end,
         updated_at = now()
   where id = new.ticket_id;
  if new.is_staff then
    insert into notification_outbox (user_id, channel, template, payload)
    select t.user_id, 'email', 'support_reply', jsonb_build_object('ticket_id', t.id, 'subject', t.subject)
    from support_tickets t where t.id = new.ticket_id;
  end if;
  return new;
end $$;
create trigger support_message_status after insert on public.support_messages
  for each row execute function public.on_support_message();

-- One open conversation per order is enough; also limits spam.
create or replace function public.support_ticket_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from support_tickets where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You can open up to 5 requests a day. Please reply on an existing one.';
  end if;
  if new.order_id is not null and not exists (select 1 from orders where id = new.order_id and user_id = new.user_id) then
    raise exception 'Order not found';
  end if;
  return new;
end $$;
create trigger support_ticket_limits before insert on public.support_tickets
  for each row execute function public.support_ticket_limits();
