(function () {
  window.LORA_INIT_WIDGET = function(authData) {
    const SUPPORT_URL = 'https://support.lorabiz.com'; 
    let widgetUrl = `${SUPPORT_URL}/widget`;

    // INJECT AUTH DATA DIRECTLY INTO URL
    if (authData && authData.userId) {
      const params = new URLSearchParams({
        userId: authData.userId,
        name: authData.name || '',
        email: authData.email || ''
      });
      widgetUrl += `?${params.toString()}`;
    }

    let existingIframe = document.getElementById('lorabiz-support-iframe');
    
    // IF THE WIDGET ALREADY EXISTS, JUST UPDATE THE URL
    if (existingIframe) {
      if (existingIframe.src !== widgetUrl) {
        existingIframe.src = widgetUrl;
      }
      return; // Stop here so we don't create duplicate containers
    }

    // OTHERWISE, CREATE THE WIDGET FOR THE FIRST TIME
    const container = document.createElement('div');
    container.id = 'lorabiz-support-widget-container';
    
    container.style.setProperty('position', 'fixed', 'important');
    container.style.setProperty('bottom', '24px', 'important');
    container.style.setProperty('right', '24px', 'important');
    container.style.setProperty('width', '85px', 'important'); 
    container.style.setProperty('height', '85px', 'important');
    container.style.setProperty('z-index', '2147483647', 'important'); 
    container.style.setProperty('border', 'none', 'important');
    container.style.setProperty('overflow', 'hidden', 'important');
    container.style.setProperty('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
    container.style.setProperty('pointer-events', 'none', 'important');
    container.style.setProperty('-webkit-transform', 'translateZ(0)', 'important');
    container.style.setProperty('transform', 'translateZ(0)', 'important');

    const iframe = document.createElement('iframe');
    iframe.src = widgetUrl; 
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
  };

  if (window.lorabizUserAuthData !== undefined) {
    window.LORA_INIT_WIDGET(window.lorabizUserAuthData);
  }

  window.addEventListener('message', function (event) {
    const container = document.getElementById('lorabiz-support-widget-container');
    if (!container) return;

    if (event.data === 'LORA_WIDGET_CLOSED') {
      container.style.setProperty('width', '85px', 'important');
      container.style.setProperty('height', '85px', 'important');
      container.style.setProperty('bottom', '24px', 'important');
      container.style.setProperty('right', '24px', 'important');
      container.style.setProperty('top', 'auto', 'important');
      container.style.setProperty('left', 'auto', 'important');
    }
    
    if (event.data === 'LORA_WIDGET_OPENED') {
      if (window.innerWidth <= 640) {
        container.style.setProperty('width', '100vw', 'important');
        container.style.setProperty('height', '100dvh', 'important');
        container.style.setProperty('bottom', '0', 'important');
        container.style.setProperty('right', '0', 'important');
        container.style.setProperty('top', '0', 'important');
        container.style.setProperty('left', '0', 'important');
      } else {
        container.style.setProperty('width', '400px', 'important'); 
        container.style.setProperty('height', '650px', 'important'); 
        container.style.setProperty('bottom', '24px', 'important');
        container.style.setProperty('right', '24px', 'important');
      }
    }
  });
})();
