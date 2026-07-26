// public/lorabiz-chat.js

(function () {
  if (document.getElementById('lorabiz-support-widget-container')) return;

  const SUPPORT_URL = 'https://support.lorabiz.com'; 

  const container = document.createElement('div');
  container.id = 'lorabiz-support-widget-container';
  
  // Set to max z-index but keep width/height minimal when closed to prevent overlapping
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '24px', // Lifted slightly off the exact bottom edge
    right: '24px',  // Lifted slightly off the exact right edge
    width: '80px',  // Tightly hug the icon
    height: '80px', // Tightly hug the icon
    zIndex: '2147483647', // Maximum possible z-index
    border: 'none',
    overflow: 'hidden',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'none', // Critical: Let clicks pass through the container box
  });

  const iframe = document.createElement('iframe');
  iframe.src = `${SUPPORT_URL}/widget`;
  iframe.id = 'lorabiz-support-iframe';
  
  // CRITICAL: Force the browser to allow a transparent iframe
  iframe.setAttribute('allowtransparency', 'true');
  
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: 'transparent',
    pointerEvents: 'auto', // Re-enable clicks ONLY inside the actual widget iframe
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
      // Expand exactly enough to fit the open chat
      container.style.width = '400px'; 
      container.style.height = '580px'; 
    }
  });
})();
