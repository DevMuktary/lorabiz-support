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

  function getHostTheme() {
    try {
      if (document.documentElement && (document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark')) {
        return 'dark';
      }
      if (document.body && (document.body.classList.contains('dark') || document.body.getAttribute('data-theme') === 'dark')) {
        return 'dark';
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {}
    return 'light';
  }

  let currentPos = getSavedPosition();
  let isWidgetOpen = false;

  window.LORA_INIT_WIDGET = function(authData) {
    const SUPPORT_URL = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('file://')) 
      ? (window.location.origin.includes('localhost') ? window.location.origin : 'https://support.lorabiz.com') 
      : 'https://support.lorabiz.com'; 

    let widgetUrl = `${SUPPORT_URL}/widget`;

    const params = new URLSearchParams();
    if (authData && authData.userId) params.set('userId', authData.userId);
    if (authData && authData.name) params.set('name', authData.name);
    if (authData && authData.email) params.set('email', authData.email);
    if (typeof window !== 'undefined' && window.location.href) {
      params.set('pageUrl', window.location.href);
    }
    params.set('theme', getHostTheme());
    widgetUrl += `?${params.toString()}`;

    let existingIframe = document.getElementById('lorabiz-support-iframe');
    if (existingIframe) {
      if (existingIframe.src !== widgetUrl) {
        existingIframe.src = widgetUrl;
      }
      return; 
    }

    currentPos = getSavedPosition();

    // Floating Container - Pure transparent, isolated from host page styles
    const container = document.createElement('div');
    container.id = 'lorabiz-support-widget-container';
    
    container.style.setProperty('position', 'fixed', 'important');
    container.style.setProperty('bottom', currentPos.bottom + 'px', 'important');
    container.style.setProperty('right', currentPos.right + 'px', 'important');
    container.style.setProperty('width', CLOSED_SIZE + 'px', 'important'); 
    container.style.setProperty('height', CLOSED_SIZE + 'px', 'important');
    container.style.setProperty('max-width', CLOSED_SIZE + 'px', 'important');
    container.style.setProperty('max-height', CLOSED_SIZE + 'px', 'important');
    container.style.setProperty('margin', '0', 'important');
    container.style.setProperty('padding', '0', 'important');
    container.style.setProperty('box-sizing', 'border-box', 'important');
    container.style.setProperty('z-index', '2147483647', 'important'); 
    container.style.setProperty('border', 'none', 'important');
    container.style.setProperty('outline', 'none', 'important');
    container.style.setProperty('background', 'transparent', 'important');
    container.style.setProperty('background-color', 'transparent', 'important');
    container.style.setProperty('box-shadow', 'none', 'important');
    container.style.setProperty('overflow', 'visible', 'important');
    container.style.setProperty('pointer-events', 'none', 'important');
    container.style.setProperty('user-select', 'none', 'important');
    container.style.setProperty('-webkit-user-select', 'none', 'important');
    container.style.setProperty('isolation', 'isolate', 'important');
    container.style.setProperty('color-scheme', 'inherit', 'important');

    const iframe = document.createElement('iframe');
    iframe.src = widgetUrl; 
    iframe.id = 'lorabiz-support-iframe';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('title', 'LoraBiz Support');
    
    iframe.style.setProperty('width', '100%', 'important');
    iframe.style.setProperty('height', '100%', 'important');
    iframe.style.setProperty('margin', '0', 'important');
    iframe.style.setProperty('padding', '0', 'important');
    iframe.style.setProperty('box-sizing', 'border-box', 'important');
    iframe.style.setProperty('border', 'none', 'important');
    iframe.style.setProperty('background', 'transparent', 'important');
    iframe.style.setProperty('background-color', 'transparent', 'important');
    iframe.style.setProperty('pointer-events', 'auto', 'important'); 
    iframe.style.setProperty('color-scheme', 'inherit', 'important');
    iframe.style.setProperty('display', 'block', 'important');

    // Drag Handle Overlay on top of iframe launcher bubble when closed
    const dragHandle = document.createElement('div');
    dragHandle.id = 'lorabiz-drag-overlay';
    dragHandle.style.setProperty('position', 'absolute', 'important');
    dragHandle.style.setProperty('inset', '8px', 'important');
    dragHandle.style.setProperty('border-radius', '50%', 'important');
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
      if (e.button !== undefined && e.button !== 0) return;

      isDragging = false;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startRight = currentPos.right;
      startBottom = currentPos.bottom;

      iframe.style.setProperty('pointer-events', 'none', 'important');
      dragHandle.style.setProperty('cursor', 'grabbing', 'important');
      container.style.setProperty('transition', 'none', 'important');

      try {
        dragHandle.setPointerCapture(e.pointerId);
      } catch (err) {}

      dragHandle.addEventListener('pointermove', handlePointerMove);
      dragHandle.addEventListener('pointerup', handlePointerUp);
      dragHandle.addEventListener('pointercancel', handlePointerUp);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
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
      if (activePointerId !== null && (e.pointerId === undefined || e.pointerId === activePointerId)) {
        try {
          dragHandle.releasePointerCapture(activePointerId);
        } catch (err) {}

        dragHandle.removeEventListener('pointermove', handlePointerMove);
        dragHandle.removeEventListener('pointerup', handlePointerUp);
        dragHandle.removeEventListener('pointercancel', handlePointerUp);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);

        activePointerId = null;
        dragHandle.style.setProperty('cursor', 'grab', 'important');
        iframe.style.setProperty('pointer-events', 'auto', 'important');

        if (isDragging) {
          const midX = (window.innerWidth - CLOSED_SIZE) / 2;
          let snapRight = currentPos.right < midX ? 16 : (window.innerWidth - CLOSED_SIZE - 16);
          snapRight = Math.max(8, Math.min(snapRight, window.innerWidth - CLOSED_SIZE - 8));

          currentPos.right = snapRight;
          container.style.setProperty('transition', 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
          container.style.setProperty('right', snapRight + 'px', 'important');
          savePosition(currentPos);
        } else {
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

    // Watch for host theme changes (dark/light)
    try {
      const themeObserver = new MutationObserver(function () {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'LORA_THEME_CHANGE', theme: getHostTheme() }, '*');
        }
      });
      if (document.documentElement) {
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
      }
      if (document.body) {
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
      }
      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'LORA_THEME_CHANGE', theme: getHostTheme() }, '*');
          }
        });
      }
    } catch (e) {}
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
    const iframe = document.getElementById('lorabiz-support-iframe');
    if (!container) return;

    if (event.data === 'LORA_WIDGET_CLOSED') {
      isWidgetOpen = false;
      if (dragOverlay) {
        dragOverlay.style.setProperty('display', 'block', 'important');
        dragOverlay.style.setProperty('pointer-events', 'auto', 'important');
      }

      container.style.removeProperty('top');
      container.style.removeProperty('left');
      container.style.removeProperty('inset');
      container.style.setProperty('width', CLOSED_SIZE + 'px', 'important');
      container.style.setProperty('height', CLOSED_SIZE + 'px', 'important');
      container.style.setProperty('max-width', CLOSED_SIZE + 'px', 'important');
      container.style.setProperty('max-height', CLOSED_SIZE + 'px', 'important');
      container.style.setProperty('bottom', currentPos.bottom + 'px', 'important');
      container.style.setProperty('right', currentPos.right + 'px', 'important');
      container.style.setProperty('pointer-events', 'none', 'important');
      if (iframe) iframe.style.setProperty('pointer-events', 'auto', 'important');
    }
    
    if (event.data === 'LORA_WIDGET_OPENED') {
      isWidgetOpen = true;
      if (dragOverlay) {
        dragOverlay.style.setProperty('display', 'none', 'important');
      }

      container.style.setProperty('pointer-events', 'auto', 'important');

      if (window.innerWidth <= 640) {
        container.style.setProperty('width', '100%', 'important');
        container.style.setProperty('height', '100%', 'important');
        container.style.setProperty('max-width', '100%', 'important');
        container.style.setProperty('max-height', '100%', 'important');
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

        container.style.removeProperty('top');
        container.style.removeProperty('left');
        container.style.removeProperty('inset');
        container.style.setProperty('width', OPEN_WIDTH + 'px', 'important'); 
        container.style.setProperty('height', OPEN_HEIGHT + 'px', 'important'); 
        container.style.setProperty('max-width', 'calc(100vw - 16px)', 'important');
        container.style.setProperty('max-height', 'calc(100vh - 16px)', 'important');
        container.style.setProperty('bottom', openBottom + 'px', 'important');
        container.style.setProperty('right', openRight + 'px', 'important');
      }
    }
  });
})();
