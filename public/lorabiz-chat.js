// public/lorabiz-chat.js

(function () {
  if (document.getElementById('lorabiz-support-widget-container')) return;

  const SUPPORT_URL = 'https://support.lorabiz.com'; 

  const container = document.createElement('div');
  container.id = 'lorabiz-support-widget-container';
  
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '24px', 
    right: '24px',  
    width: '80px',  
    height: '80px', 
    zIndex: '2147483647', 
    border: 'none',
    overflow: 'hidden',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'none',
    // Safari-specific fixes to enforce rendering priority
    WebkitTransform: 'translateZ(0)',
    transform: 'translateZ(0)',
  });

  const iframe = document.createElement('iframe');
  iframe.src = `${SUPPORT_URL}/widget`;
  iframe.id = 'lorabiz-support-iframe';
  
  iframe.setAttribute('allowtransparency', 'true');
  
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: 'transparent',
    pointerEvents: 'auto', 
    colorScheme: 'normal',
  });

  container.appendChild(iframe);
  document.body.appendChild(container);

  window.addEventListener('message', function (event) {
    if (event.data === 'LORA_WIDGET_CLOSED') {
      container.style.width = '80px';
      container.style.height = '80px';
    }
    if (event.data === 'LORA_WIDGET_OPENED') {
      container.style.width = '400px'; 
      container.style.height = '580px'; 
    }
  });
})();
