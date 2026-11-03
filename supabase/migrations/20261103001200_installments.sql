-- Installment amounts in whole rupees: later payments are rounded down to the rupee,
-- the first payment takes the remainder. Falls back to paise for tiny totals.
create or replace function public.installment_split(p_total bigint, p_count int)
returns bigint[] language plpgsql immutable as $$
declare v_each bigint; v_first bigint;
begin
  if p_count < 1 or p_total < p_count then raise exception 'Invalid installment split'; end if;
  v_each := (p_total / p_count / 100) * 100;
  if v_each = 0 then v_each := p_total / p_count; end if;
  v_first := p_total - v_each * (p_count - 1);
  return array[v_first] || array_fill(v_each, array[p_count - 1]);
end $$;
