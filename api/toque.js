// Comitag · Registro con un toque (Atajos de iPhone).
// El atajo abre esta dirección al acercar el teléfono al plato, y muestra como
// notificación el texto que se devuelve. Vercel la publica sola en /api/toque.
//
//   /api/toque?c=<código>&k=comida|agua&w=<nombre>&pin=<PIN>&m=<mascota opcional>
//   &prueba=1  → solo revisa que todo esté bien, sin registrar nada.

const SB = "https://nwenbwkpvmfozzfwjsuq.supabase.co";
const KEY = "sb_publishable_bo4ntmZshkQk9lSiadueKg_ANPjpuRa"; // la misma llave pública de la página
const REPETIDA_MIN = 30; // si ya comió hace menos de esto, no se registra otra vez

async function rpc(fn, args) {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  if (!r.ok) throw new Error((d && d.message) || t || `error ${r.status}`);
  return d;
}

const hora = d => new Date(d).toLocaleTimeString("es-CL",
  { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function texto(res, status, msg) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(msg);
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const code = String(q.c || "").trim();
  const kind = q.k === "agua" ? "agua" : "comida";
  const who = String(q.w || "").trim().slice(0, 40);
  const pin = String(q.pin || "").trim() || null;
  const pet = String(q.m || "").trim().slice(0, 20) || null;
  const prueba = q.prueba === "1";

  if (!/^[A-Za-z0-9_-]{4,40}$/.test(code)) return texto(res, 400, "❌ Al atajo le falta el código del plato. Cópialo de nuevo desde Comitag.");
  if (!who) return texto(res, 400, "❌ Al atajo le falta tu nombre. Cópialo de nuevo desde Comitag.");

  try {
    const plate = await rpc("get_plate2", { p_code: code });
    if (!plate) return texto(res, 404, "❌ No encontré ese plato. Cópialo de nuevo desde Comitag.");
    const name = pet || plate.pet_name || "tu mascota";

    const log = await rpc("get_entries2", { p_code: code, p_pin: pin });
    if (typeof log === "string") return texto(res, 403, `🔒 ${log}. Copia el atajo de nuevo desde Comitag con el PIN actual.`);

    // ¿Ya comió hace poco? (así no se le da doble)
    if (kind === "comida") {
      const now = Date.now();
      const last = (log || []).find(e => e.kind === "comida" && (!pet || !e.pet || e.pet === pet));
      const mins = last ? Math.round((now - new Date(last.created_at).getTime()) / 60000) : Infinity;
      if (!prueba && mins < REPETIDA_MIN) {
        const quien = last.who === who ? "Tú ya" : `${last.who} ya`;
        return texto(res, 200, `⚠️ ${quien} le dio comida a ${name} a las ${hora(last.created_at)} (hace ${mins} min). No registré nada para no repetir.`);
      }
    }

    const que = kind === "comida" ? "Comida" : "Agua";
    if (prueba) return texto(res, 200, `✅ Todo listo: al acercar el teléfono se registrará ${que.toLowerCase()} de ${name} a nombre de ${who}.`);

    const st = await rpc("add_entry_at", {
      p_code: code, p_kind: kind, p_who: who, p_at: new Date().toISOString(),
      p_client_id: "atajo-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      p_note: null, p_pin: pin, p_pet: pet,
    });
    if (st !== "ok") return texto(res, 403, `🔒 ${st}. Copia el atajo de nuevo desde Comitag con el PIN actual.`);
    return texto(res, 200, `✅ ${que} de ${name} registrada a las ${hora(new Date())}`);
  } catch (e) {
    console.error("toque", e);
    return texto(res, 500, "❌ No pude registrar (problema de conexión). Ábrelo en Comitag para marcarlo.");
  }
};
