const ALLOWED = {
  language: new Set(['ko','fr']),
  target: new Set(['kid','senior','self']),
  target_age: new Set(['0-6','7-9','10-12','13plus','20s','30s','40s','50s','60s','60plus','70s','80plus']),
  intervention: new Set(['alert','review','join','adaptive']),
  respondent_age: new Set(['20s','30s','40s','50s','60s','60plus','70s','80plus']),
  intent: new Set(['definitely','trial','situational','unsure'])
};

const MAX = {
  utm_source: 300,
  utm_medium: 300,
  utm_campaign: 300,
  utm_content: 300,
  utm_term: 300,
  fbclid: 300,
  referrer: 500,
  page_path: 300,
  variant: 80
};

function text(v, max){
  if(v == null) return null;
  return String(v).slice(0, max);
}

function bad(res, status, error){
  res.status(status).json({ ok:false, error });
}

module.exports = async function handler(req, res){
  if(req.method !== 'POST'){
    res.setHeader('Allow','POST');
    return bad(res, 405, 'method_not_allowed');
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY){
    console.error('[CALL X] Missing Supabase environment variables');
    return bad(res, 500, 'server_not_configured');
  }

  const b = req.body || {};

  // Honeypot: bots often fill hidden fields.
  if(String(b.website || '').trim()){
    return res.status(200).json({ ok:true });
  }

  if(!ALLOWED.language.has(b.language)) return bad(res, 400, 'invalid_language');
  if(!ALLOWED.target.has(b.target)) return bad(res, 400, 'invalid_target');
  if(!ALLOWED.target_age.has(b.target_age)) return bad(res, 400, 'invalid_target_age');
  if(!ALLOWED.intervention.has(b.intervention)) return bad(res, 400, 'invalid_intervention');
  if(!ALLOWED.respondent_age.has(b.respondent_age)) return bad(res, 400, 'invalid_respondent_age');
  if(!ALLOWED.intent.has(b.intent)) return bad(res, 400, 'invalid_intent');

  const row = {
    language: b.language,
    target: b.target,
    target_age: b.target_age,
    intervention: b.intervention,
    respondent_age: b.respondent_age,
    intent: b.intent,
    utm_source: text(b.utm_source, MAX.utm_source),
    utm_medium: text(b.utm_medium, MAX.utm_medium),
    utm_campaign: text(b.utm_campaign, MAX.utm_campaign),
    utm_content: text(b.utm_content, MAX.utm_content),
    utm_term: text(b.utm_term, MAX.utm_term),
    fbclid: text(b.fbclid, MAX.fbclid),
    referrer: text(b.referrer, MAX.referrer),
    page_path: text(b.page_path, MAX.page_path),
    variant: text(b.variant, MAX.variant)
  };

  try{
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/,'')}/rest/v1/call_x_survey`, {
      method:'POST',
      headers:{
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type':'application/json',
        'Prefer':'return=minimal'
      },
      body:JSON.stringify(row)
    });

    if(!response.ok){
      const detail = await response.text();
      console.error('[CALL X] Supabase insert failed', response.status, detail);
      return bad(res, 502, 'storage_failed');
    }

    res.status(200).json({ ok:true });
  }catch(err){
    console.error('[CALL X] survey handler error', err);
    return bad(res, 500, 'server_error');
  }
}
