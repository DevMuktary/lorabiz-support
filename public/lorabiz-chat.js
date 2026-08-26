(function () {
  if (window.LORA_INIT_WIDGET) return;

  const STORAGE_POS_KEY = 'lorabiz_support_widget_pos';
  const CLOSED_SIZE = 84; // width and height in px for launcher

  function getSavedPosition() {
    try {
      const saved = localStorage.getItem(STORAGE_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.right === 'number' && typeof parsed.bottom === 'number') {
          const maxRight = Math.max(12, window.innerWidth - CLOSED_SIZE - 12);
          const maxBottom = Math.max(12, window.innerHeight - CLOSED_SIZE - 12);
          return {
            right: Math.min(Math.max(12, parsed.right), maxRight),
            bottom: Math.min(Math.max(12, parsed.bottom), maxBottom)
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

    const container = document.createElement('div');
    container.id = 'lorabiz-support-widget-container';
    
    container.style.setProperty('position', 'fixed', 'important');
    container.style.setProperty('bottom', currentPos.bottom + 'px', 'important');
    container.style.setProperty('right', currentPos.right + 'px', 'important');
    container.style.setProperty('width', CLOSED_SIZE + 'px', 'important'); 
    container.style.setProperty('height', CLOSED_SIZE + 'px', 'important');
    container.style.setProperty('z-index', '2147483647', 'important'); 
    container.style.setProperty('border', 'none', 'important');
    container.style.setProperty('overflow', 'visible', 'important');
    container.style.setProperty('background', 'transparent', 'important');
    container.style.setProperty('transition', 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
    container.style.setProperty('pointer-events', 'auto', 'important');
    container.style.setProperty('touch-action', 'none', 'important');
    container.style.setProperty('-webkit-transform', 'translateZ(0)', 'important');
    container.style.setProperty('transform', 'translateZ(0)', 'important');

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

    // Drag Handle Overlay for when widget is closed
    const dragHandle = document.createElement('div');
    dragHandle.id = 'lorabiz-drag-overlay';
    dragHandle.style.setProperty('position', 'absolute', 'important');
    dragHandle.style.setProperty('inset', '0', 'important');
    dragHandle.style.setProperty('cursor', 'grab', 'important');
    dragHandle.style.setProperty('z-index', '10', 'important');
    dragHandle.style.setProperty('background', 'transparent', 'important');
    dragHandle.style.setProperty('pointer-events', 'auto', 'important');
    dragHandle.setAttribute('title', 'Drag to move or click to open');

    let isPointerDown = false;
    let hasDragged = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let startRight = currentPos.right;
    let startBottom = currentPos.bottom;

    function onPointerDown(e) {
      if (isWidgetOpen) return;
      isPointerDown = true;
      hasDragged = false;
      startPointerX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      startPointerY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      startRight = currentPos.right;
      startBottom = currentPos.bottom;

      container.style.setProperty('transition', 'none', 'important');
      dragHandle.style.setProperty('cursor', 'grabbing', 'important');

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
      if (!isPointerDown) return;
      const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      const deltaX = clientX - startPointerX;
      const deltaY = clientY - startPointerY;

      if (!hasDragged && Math.hypot(deltaX, deltaY) > 5) {
        hasDragged = true;
      }

      if (hasDragged) {
        if (e.cancelable) e.preventDefault();

        // Calculate new right and bottom coordinates
        let newRight = startRight - deltaX;
        let newBottom = startBottom - deltaY;

        // Clamp inside window boundaries
        const maxRight = Math.max(10, window.innerWidth - CLOSED_SIZE - 10);
        const maxBottom = Math.max(10, window.innerHeight - CLOSED_SIZE - 10);

        newRight = Math.min(Math.max(10, newRight), maxRight);
        newBottom = Math.min(Math.max(10, newBottom), maxBottom);

        currentPos = { right: newRight, bottom: newBottom };
        container.style.setProperty('right', newRight + 'px', 'important');
        container.style.setProperty('bottom', newBottom + 'px', 'important');
      }
    }

    function onPointerUp() {
      if (!isPointerDown) return;
      isPointerDown = false;

      dragHandle.style.setProperty('cursor', 'grab', 'important');
      container.style.setProperty('transition', 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      if (hasDragged) {
        savePosition(currentPos);
      } else {
        // Simple tap / click -> open widget
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage('LORA_TOGGLE_OPEN', '*');
        }
      }
    }

    dragHandle.addEventListener('pointerdown', onPointerDown);
    dragHandle.addEventListener('touchstart', onPointerDown, { passive: true });

    container.appendChild(iframe);
    container.appendChild(dragHandle);
    document.body.appendChild(container);
  };

  if (window.lorabizUserAuthData !== undefined) {
    window.LORA_INIT_WIDGET(window.lorabizUserAuthData);
  }

  // Handle window resize to keep widget on screen
  window.addEventListener('resize', function () {
    const container = document.getElementById('lorabiz-support-widget-container');
    if (!container || isWidgetOpen) return;

    const maxRight = Math.max(10, window.innerWidth - CLOSED_SIZE - 10);
    const maxBottom = Math.max(10, window.innerHeight - CLOSED_SIZE - 10);

    currentPos.right = Math.min(Math.max(10, currentPos.right), maxRight);
    currentPos.bottom = Math.min(Math.max(10, currentPos.bottom), maxBottom);

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

        // Position open window comfortably within screen bounds
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
