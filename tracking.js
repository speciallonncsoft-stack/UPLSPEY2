/* ============================================================================
   tracking.js  —  GA4 이벤트 추적 (랜딩페이지 공용)
   ----------------------------------------------------------------------------
   이 파일 하나로 모든 랜딩페이지의 GA4 추적이 처리됩니다.
   각 HTML은 </body> 앞에 <script src="tracking.js"></script> 한 줄만 있으면 됨.

   ▣ 딱 하나만 교체하세요 (GA4 측정 ID):
        아래 GA4_ID 값을 실제 ID로 바꿉니다.

   ▣ 페이지 이름 (자동 · 손댈 것 없음)
        각 페이지의 Vercel 주소를 그대로 GA 경로 이름으로 씁니다.
          familyprotection-landing.vercel.app  →  /familyprotection-landing
          soho-ai-answering.vercel.app         →  /soho-ai-answering
          factcheck-landing.vercel.app         →  /factcheck-landing
          ai-call-assistant-landing.vercel.app →  /ai-call-assistant-landing
        → 페이지마다 이 파일을 그대로 복사만 하면 됩니다. 매핑·수정 불필요.
        → 새 랜딩페이지가 생겨도 이 파일을 그대로 넣기만 하면 자동 적용.

   ▣ 잡는 이벤트 (4개)
        page_view / cta_click / survey_start / survey_complete
   ============================================================================ */

(function () {
  'use strict';

  /* ▼▼▼ 여기만 교체 ▼▼▼ */
  var GA4_ID = 'G-0MH9230B7L';
  /* ▲▲▲ 여기만 교체 ▲▲▲ */

  var idReady = /^G-[A-Z0-9]+$/i.test(GA4_ID) && GA4_ID !== 'G-XXXXXXXXXX';

  /* ---- Vercel 주소(hostname) → GA 경로 이름 자동 생성 ----
     예) familyprotection-landing.vercel.app → /familyprotection-landing
     - *.vercel.app : 맨 앞 서브도메인을 경로 이름으로 사용
     - 커스텀 도메인 / 그 외 : 실제 경로(location.pathname) 사용
     - localhost / 파일 : 실제 경로 그대로 */
  function resolvePagePath() {
    var host = location.hostname || '';

    // localhost / 로컬 IP / file:// → 실제 경로
    if (host === 'localhost' || /^(127\.0\.0\.1|\[::1\])$/.test(host) || location.protocol === 'file:') {
      return location.pathname || '/';
    }

    // *.vercel.app → 맨 앞 라벨을 경로로
    if (/\.vercel\.app$/i.test(host)) {
      var sub = host.replace(/\.vercel\.app$/i, '');
      var first = sub.split('.')[0];
      if (first) return '/' + first;
    }

    // 그 외(커스텀 도메인 등) → 실제 경로 사용
    return location.pathname || '/';
  }

  var PAGE_PATH = resolvePagePath();

  /* ---- GA4(gtag) 로드 : ID가 준비됐을 때만 ---- */
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }

  if (idReady) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);

    gtag('js', new Date());
    // 실제 URL이 '/' 여도 GA에는 Vercel 주소 기반 경로 이름으로 기록.
    // page_title 은 원래 <title> 그대로 유지(제목 카드도 계속 정상).
    gtag('config', GA4_ID, {
      page_path: PAGE_PATH,
      page_title: document.title
    });
  } else {
    console.warn('[tracking] GA4 측정 ID가 아직 없습니다. 이벤트는 콘솔에만 기록됩니다.');
  }

  /* ---- 이벤트 전송 헬퍼 ---- */
  function sendEvent(name, params) {
    params = params || {};
    // 모든 이벤트에 페이지 식별자를 함께 실어 페이지별 비교를 쉽게 함
    params.page_path = PAGE_PATH;
    if (idReady && typeof gtag === 'function') {
      gtag('event', name, params);
    }
    console.log('[tracking] ' + name + '  (' + PAGE_PATH + ')', params);
  }

  /* ---- 페이지에서 실행 ---- */
  function init() {

    /* 1) CTA 클릭 : href가 #survey 로 가는 모든 버튼/링크 */
    document.querySelectorAll('a[href="#survey"]').forEach(function (el) {
      el.addEventListener('click', function () {
        sendEvent('cta_click', {
          location: el.closest('.mobile-sticky') ? 'sticky'
                  : el.closest('.hero')          ? 'hero'
                  : el.closest('.header')        ? 'header'
                  : el.closest('.final-cta')     ? 'final'
                  : 'other'
        });
      });
    });

    /* 2) 설문 시작 : 설문 영역 안의 옵션(.option)을 처음 누른 순간 1회만 */
    var surveyStarted = false;
    var surveyRoot = document.getElementById('survey');
    if (surveyRoot) {
      surveyRoot.addEventListener('click', function (e) {
        var opt = e.target.closest('.option');
        if (opt && !surveyStarted) {
          surveyStarted = true;
          sendEvent('survey_start', {});
        }
      });
    }

    /* 3) 설문 완료 : 성공 화면(#surveySuccess)에 'show' 클래스가 붙는 순간 감지 */
    var success = document.getElementById('surveySuccess');
    if (success && 'MutationObserver' in window) {
      var fired = false;
      var mo = new MutationObserver(function () {
        if (!fired && success.classList.contains('show')) {
          fired = true;
          var params = { language: document.documentElement.lang || 'ko' };
          try {
            var rows = document.querySelectorAll('#surveySummary .summary-row');
            rows.forEach(function (row, i) {
              var val = row.querySelector('strong');
              if (val) params['answer_' + (i + 1)] = val.textContent.trim().slice(0, 90);
            });
          } catch (err) { /* 요약 못 읽어도 완료 자체는 기록 */ }
          sendEvent('survey_complete', params);
        }
      });
      mo.observe(success, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
