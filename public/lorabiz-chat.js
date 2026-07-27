(function () {
  if (document.getElementById('lorabiz-support-widget-container')) return;

  const SUPPORT_URL = 'https://support.lorabiz.com'; 

  const container = document.createElement('div');
  container.id = 'lorabiz-support-widget-container';
  
  // Use setProperty to force !important on z-index
  container.style.setProperty('position', 'fixed', 'important');
  container.style.setProperty('bottom', '24px', 'important');
  container.style.setProperty('right', '24px', 'important');
  container.style.setProperty('width', '85px', 'important'); // Matches new avatar size
  container.style.setProperty('height', '85px', 'important');
  container.style.setProperty('z-index', '2147483647', 'important'); 
  container.style.setProperty('border', 'none', 'important');
  container.style.setProperty('overflow', 'hidden', 'important');
  container.style.setProperty('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
  container.style.setProperty('pointer-events', 'none', 'important');
  
  // Safari-specific fixes
  container.style.setProperty('-webkit-transform', 'translateZ(0)', 'important');
  container.style.setProperty('transform', 'translateZ(0)', 'important');

  const iframe = document.createElement('iframe');
  iframe.src = `${SUPPORT_URL}/widget`;
  iframe.id = 'lorabiz-support-iframe';
  iframe.setAttribute('allowtransparency', 'true');
  
  iframe.style.setProperty('width', '100%', 'important');
  iframe.style.setProperty('height', '100%', 'important');
  iframe.style.setProperty('border', 'none', 'important');
  iframe.style.setProperty('background-color', 'transparent', 'important');
  iframe.style.setProperty('pointer-events', 'auto', 'important'); 
  iframe.style.setProperty('color-scheme', 'normal', 'important');

  container.appendChild(iframe);
  document.body.appendChild(container);

  window.addEventListener('message', function (event) {
    if (event.data === 'LORA_WIDGET_CLOSED') {
      container.style.setProperty('width', '85px', 'important');
      container.style.setProperty('height', '85px', 'important');
      container.style.setProperty('bottom', '24px', 'important');
      container.style.setProperty('right', '24px', 'important');
    }
    if (event.data === 'LORA_WIDGET_OPENED') {
      // Make it fullscreen on mobile, standard box on desktop
      if (window.innerWidth <= 640) {
        container.style.setProperty('width', '100%', 'important');
        container.style.setProperty('height', '100%', 'important');
        container.style.setProperty('bottom', '0', 'important');
        container.style.setProperty('right', '0', 'important');
      } else {
        container.style.setProperty('width', '400px', 'important'); 
        container.style.setProperty('height', '650px', 'important'); 
        container.style.setProperty('bottom', '24px', 'important');
        container.style.setProperty('right', '24px', 'important');
      }
    }
  });
})();
