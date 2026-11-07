import React from 'react';
import PassportView from './PassportView';
import { getScanHistory } from '../utils/storage';

export default function HistoryTab({ onSelectProduct, onOpenScanner }) {
  const history = getScanHistory();

  return (
    <PassportView
      product={history[0] || null}
      title="History"
      onScanAgain={onOpenScanner}
      onReportProduct={(prod) => onSelectProduct && onSelectProduct(prod, 'report')}
      onBack={onOpenScanner}
    />
  );
}
