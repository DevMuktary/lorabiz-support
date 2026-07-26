// public/lorabiz-chat.js

(function () {
  // Prevent multiple injections
  if (document.getElementById('lorabiz-support-widget-container')) return;

  // The base URL of your Next.js support dashboard. 
  // Update this to your actual production domain before going live.
  const SUPPORT_URL = 'https://support.lorabiz.com'; 

  // Create the container
  const container = document.createElement('div');
  container.id = 'lorabiz-support-widget-container';
  
  // Style the container to sit in the bottom right corner.
  // We start it small (80x80) so it only covers the launcher button.
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '0',
    right: '0',
    width: '100px', 
    height: '100px',
    zIndex: '999999',
    pointerEvents: 'none', // Allows clicking through transparent parts
    border: 'none',
    overflow: 'hidden',
  });

  // Create the iframe
  const iframe = document.createElement('iframe');
  iframe.src = `${SUPPORT_URL}/widget`;
  iframe.id = 'lorabiz-support-iframe';
  
  // Style the iframe
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: 'transparent',
    pointerEvents: 'auto', // Re-enables clicking inside the actual widget
  });

  // Append elements to the DOM
  container.appendChild(iframe);
  document.body.appendChild(container);

  // Listen for messages from the iframe to resize the container dynamically
  window.addEventListener('message', function (event) {
    // For security, ensure the message is coming from your support domain
    if (event.origin !== SUPPORT_URL) return;
    
    if (event.data === 'LORA_WIDGET_CLOSED') {
      container.style.width = '100px';
      container.style.height = '100px';
    }
    if (event.data === 'LORA_WIDGET_OPENED') {
      container.style.width = '420px'; // Wide enough for the open chat plus shadow
      container.style.height = '600px'; // Tall enough for the open chat
    }
  });
})();
