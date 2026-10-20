import React, { useEffect, useState } from 'react';
import { QrReader } from 'react-qr-reader';

const QrScanner = ({ passData }) => {
  const [data, setData] = useState('');

  useEffect(() => {
    if (data) {
      passData(data);
    }
  }, [data, passData]);

  return (
    <>
      <QrReader
        onResult={(result, error) => {
          if (result) {
            setData(result?.text);
          }
        }}
        style={{ width: '100%' }}
      />
    </>
  );
};

export default QrScanner;
