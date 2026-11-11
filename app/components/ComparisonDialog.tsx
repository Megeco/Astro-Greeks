'use client';

import {useEffect, useRef, type ReactNode} from 'react';

export default function ComparisonDialog({
 open,
 onClose,
 referenceDate,
 children,
}: {
 open: boolean;
 onClose: () => void;
 referenceDate: string;
 children: ReactNode;
}) {
 const dialog = useRef<HTMLDialogElement>(null);

 useEffect(() => {
  const element = dialog.current;
  if (open && element && !element.open) element.showModal();
  if (!open && element?.open) element.close();
 }, [open]);

 return <dialog ref={dialog} className="match-comparison-dialog" onClose={onClose} aria-labelledby="match-comparison-title">
  <header className="match-comparison-header">
   <div>
    <h2 id="match-comparison-title">Compare selected dates</h2>
    <p>Reference {referenceDate}</p>
   </div>
   <button type="button" className="ghost" onClick={onClose}>Close comparison</button>
  </header>
  <div className="match-comparison-grid">{children}</div>
 </dialog>;
}
