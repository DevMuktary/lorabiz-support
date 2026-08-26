(function () {
  if (window.LORA_INIT_WIDGET) return;

  const STORAGE_POS_KEY = 'lorabiz_support_widget_pos';
  const CLOSED_SIZE = 76; // compact size in px for launcher bubble

  function getSavedPosition() {
    try {
      const saved = localStorage.getItem(STORAGE_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.right === 'number' && typeof parsed.bottom === 'number') {
          const maxRight = Math.max(8, window.innerWidth - CLOSED_SIZE - 8);
          const maxBottom = Math.max(8, window.innerHeight - CLOSED_SIZE - 8);
          return {
            right: Math.min(Math.max(8, parsed.right), maxRight),
            bottom: Math.min(Math.max(8, parsed.bottom), maxBottom)
          };
        }
      }
    } catch (e) {}
    return { right: 24, bottom: 24 };
  }

  function savePosition(pos) {
    try {
      localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
    } catch (e) {}
  }

  let currentPos = getSavedPosition();
  let isWidgetOpen = false;

  window.LORA_INIT_WIDGET = function(authData) {
    const SUPPORT_URL = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('file://')) 
      ? (window.location.origin.includes('localhost') ? window.location.origin : 'https://support.lorabiz.com') 
      : 'https://support.lorabiz.com'; 

    let widgetUrl = `${SUPPORT_URL}/widget`;

    if (authData && authData.userId) {
      const params = new URLSearchParams({
        userId: authData.userId,
        name: authData.name || '',
        email: authData.email || ''
      });
      widgetUrl += `?${params.toString()}`;
    }

    let existingIframe = document.getElementById('lorabiz-support-iframe');
    if (existingIframe) {
      if (existingIframe.src !== widgetUrl) {
        existingIframe.src = widgetUrl;
      }
      return; 
    }

    currentPos = getSavedPosition();

    // Floating Container - Self-contained, does not affect dashboard flow
    const container = document.createElement('div');
    container.id = 'lorabiz-support-widget-container';
    
    container.style.setProperty('position', 'fixed', 'important');
    container.style.setProperty('bottom', currentPos.bottom + 'px', 'important');
    container.style.setProperty('right', currentPos.right + 'px', 'important');
    container.style.setProperty('width', CLOSED_SIZE + 'px', 'important'); 
    container.style.setProperty('height', CLOSED_SIZE + 'px', 'important');
    container.style.setProperty('z-index', '2147483647', 'important'); 
    container.style.setProperty('border', 'none', 'important');
    container.style.setProperty('background', 'transparent', 'important');
    container.style.setProperty('pointer-events', 'auto', 'important');
    container.style.setProperty('user-select', 'none', 'important');
    container.style.setProperty('-webkit-user-select', 'none', 'important');

    const iframe = document.createElement('iframe');
    iframe.src = widgetUrl; 
    iframe.id = 'lorabiz-support-iframe';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('title', 'LoraBiz Support');
    
    iframe.style.setProperty('width', '100%', 'important');
    iframe.style.setProperty('height', '100%', 'important');
    iframe.style.setProperty('border', 'none', 'important');
    iframe.style.setProperty('background-color', 'transparent', 'important');
    iframe.style.setProperty('pointer-events', 'auto', 'important'); 
    iframe.style.setProperty('color-scheme', 'normal', 'important');

    // Drag Handle Overlay on top of iframe when closed
    const dragHandle = document.createElement('div');
    dragHandle.id = 'lorabiz-drag-overlay';
    dragHandle.style.setProperty('position', 'absolute', 'important');
    dragHandle.style.setProperty('inset', '0', 'important');
    dragHandle.style.setProperty('cursor', 'grab', 'important');
    dragHandle.style.setProperty('z-index', '10', 'important');
    dragHandle.style.setProperty('background', 'transparent', 'important');
    dragHandle.style.setProperty('pointer-events', 'auto', 'important');
    dragHandle.style.setProperty('touch-action', 'none', 'important');
    dragHandle.setAttribute('title', 'Drag to move or click to open');

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startBottom = 0;
    let activePointerId = null;

    function handlePointerDown(e) {
      if (isWidgetOpen) return;
      if (e.button !== undefined && e.button !== 0) return; // Primary mouse button only

      isDragging = false;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startRight = currentPos.right;
      startBottom = currentPos.bottom;

      // Disable iframe pointer events during drag to prevent trapping mousemove
      iframe.style.setProperty('pointer-events', 'none', 'important');
      dragHandle.style.setProperty('cursor', 'grabbing', 'important');

      try {
        dragHandle.setPointerCapture(e.pointerId);
      } catch (err) {}

      dragHandle.addEventListener('pointermove', handlePointerMove);
      dragHandle.addEventListener('pointerup', handlePointerUp);
      dragHandle.addEventListener('pointercancel', handlePointerUp);
    }

    function handlePointerMove(e) {
      if (activePointerId === null || e.pointerId !== activePointerId) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (!isDragging && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
        isDragging = true;
      }

      if (isDragging) {
        let newRight = startRight - deltaX;
        let newBottom = startBottom - deltaY;

        const maxRight = Math.max(8, window.innerWidth - CLOSED_SIZE - 8);
        const maxBottom = Math.max(8, window.innerHeight - CLOSED_SIZE - 8);

        newRight = Math.min(Math.max(8, newRight), maxRight);
        newBottom = Math.min(Math.max(8, newBottom), maxBottom);

        currentPos = { right: newRight, bottom: newBottom };
        container.style.setProperty('right', newRight + 'px', 'important');
        container.style.setProperty('bottom', newBottom + 'px', 'important');
      }
    }

    function handlePointerUp(e) {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        try {
          dragHandle.releasePointerCapture(e.pointerId);
        } catch (err) {}

        dragHandle.removeEventListener('pointermove', handlePointerMove);
        dragHandle.removeEventListener('pointerup', handlePointerUp);
        dragHandle.removeEventListener('pointercancel', handlePointerUp);

        activePointerId = null;
        dragHandle.style.setProperty('cursor', 'grab', 'important');
        iframe.style.setProperty('pointer-events', 'auto', 'important');

        if (isDragging) {
          savePosition(currentPos);
        } else {
          // Normal click -> Open widget
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage('LORA_TOGGLE_OPEN', '*');
          }
        }
      }
    }

    dragHandle.addEventListener('pointerdown', handlePointerDown);

    container.appendChild(iframe);
    container.appendChild(dragHandle);
    document.body.appendChild(container);
  };

  if (window.lorabizUserAuthData !== undefined) {
    window.LORA_INIT_WIDGET(window.lorabizUserAuthData);
  }

  // Handle window resize boundary clamping
  window.addEventListener('resize', function () {
    const container = document.getElementById('lorabiz-support-widget-container');
    if (!container || isWidgetOpen) return;

    const maxRight = Math.max(8, window.innerWidth - CLOSED_SIZE - 8);
    const maxBottom = Math.max(8, window.innerHeight - CLOSED_SIZE - 8);

    currentPos.right = Math.min(Math.max(8, currentPos.right), maxRight);
    currentPos.bottom = Math.min(Math.max(8, currentPos.bottom), maxBottom);

    container.style.setProperty('right', currentPos.right + 'px', 'important');
    container.style.setProperty('bottom', currentPos.bottom + 'px', 'important');
    savePosition(currentPos);
  });

  window.addEventListener('message', function (event) {
    const container = document.getElementById('lorabiz-support-widget-container');
    const dragOverlay = document.getElementById('lorabiz-drag-overlay');
    if (!container) return;

    if (event.data === 'LORA_WIDGET_CLOSED') {
      isWidgetOpen = false;
      if (dragOverlay) dragOverlay.style.setProperty('display', 'block', 'important');

      container.style.setProperty('width', CLOSED_SIZE + 'px', 'important');
      container.style.setProperty('height', CLOSED_SIZE + 'px', 'important');
      container.style.setProperty('bottom', currentPos.bottom + 'px', 'important');
      container.style.setProperty('right', currentPos.right + 'px', 'important');
      container.style.setProperty('top', 'auto', 'important');
      container.style.setProperty('left', 'auto', 'important');
    }
    
    if (event.data === 'LORA_WIDGET_OPENED') {
      isWidgetOpen = true;
      if (dragOverlay) dragOverlay.style.setProperty('display', 'none', 'important');

      if (window.innerWidth <= 640) {
        container.style.setProperty('width', '100vw', 'important');
        container.style.setProperty('height', '100dvh', 'important');
        container.style.setProperty('bottom', '0', 'important');
        container.style.setProperty('right', '0', 'important');
        container.style.setProperty('top', '0', 'important');
        container.style.setProperty('left', '0', 'important');
      } else {
        const OPEN_WIDTH = 400;
        const OPEN_HEIGHT = 650;

        let openRight = currentPos.right;
        let openBottom = currentPos.bottom;

        if (openRight + OPEN_WIDTH > window.innerWidth - 12) {
          openRight = Math.max(12, window.innerWidth - OPEN_WIDTH - 12);
        }
        if (openBottom + OPEN_HEIGHT > window.innerHeight - 12) {
          openBottom = Math.max(12, window.innerHeight - OPEN_HEIGHT - 12);
        }

        container.style.setProperty('width', OPEN_WIDTH + 'px', 'important'); 
        container.style.setProperty('height', OPEN_HEIGHT + 'px', 'important'); 
        container.style.setProperty('bottom', openBottom + 'px', 'important');
        container.style.setProperty('right', openRight + 'px', 'important');
        container.style.setProperty('top', 'auto', 'important');
        container.style.setProperty('left', 'auto', 'important');
      }
    }
  });
})();
