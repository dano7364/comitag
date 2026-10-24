-- 1) Una sola vez: permitir platos sin mascota todavía (los "sin dueño").
alter table plates alter column pet_name drop not null;

-- 2) Cada vez que necesites pegatinas nuevas: cambia el 10 por la cantidad que quieras.
--    Te devuelve un link por plato para grabar en cada pegatina NFC.
--    El "?nfc=1" del final le avisa a la página que se abrió desde la pegatina (no lo quites).
insert into plates (pet_name)
select null from generate_series(1, 10)
returning 'https://comitag.vercel.app/p/' || code || '?nfc=1' as link;

-- 3) Para volver a grabar pegatinas que ya entregaste (con la marca "?nfc=1"):
--    te devuelve el link de cada plato existente, con el nombre de su mascota.
-- select coalesce(pet_name, '(sin mascota aún)') as mascota,
--        'https://comitag.vercel.app/p/' || code || '?nfc=1' as link
-- from plates order by pet_name nulls last;
