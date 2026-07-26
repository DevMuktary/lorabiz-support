// public/lorabiz-chat.js

(function () {
  if (document.getElementById('lorabiz-support-widget-container')) return;

  const SUPPORT_URL = 'https://support.lorabiz.com'; 

  const container = document.createElement('div');
  container.id = 'lorabiz-support-widget-container';
  
  // No pointer-events hacks. The container is exactly the size of the button.
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '0',
    right: '0',
    width: '100px', 
    height: '100px',
    zIndex: '999999',
    border: 'none',
    overflow: 'hidden',
    transition: 'width 0.3s ease, height 0.3s ease', // Smooth resizing
  });

  const iframe = document.createElement('iframe');
  iframe.src = `${SUPPORT_URL}/widget`;
  iframe.id = 'lorabiz-support-iframe';
  
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: 'transparent',
  });

  container.appendChild(iframe);
  document.body.appendChild(container);

  window.addEventListener('message', function (event) {
    // Uncomment this strict origin check when deploying to production!
    // if (event.origin !== SUPPORT_URL) return; 
    
    if (event.data === 'LORA_WIDGET_CLOSED') {
      container.style.width = '100px';
      container.style.height = '100px';
    }
    if (event.data === 'LORA_WIDGET_OPENED') {
      container.style.width = '420px'; 
      container.style.height = '600px'; 
    }
  });
})();
