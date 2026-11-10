import { useEffect, useState } from 'react';

/** 软键盘弹出时隐藏底栏，避免挡住搜索框 */
export function useVisualViewportKeyboard(thresholdPx = 96) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const occluded = window.innerHeight - vv.height - vv.offsetTop;
      setOpen(occluded > thresholdPx);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [thresholdPx]);

  return open;
}
