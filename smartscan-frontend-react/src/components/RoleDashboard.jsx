import '../css/Role.css';
import { Button } from './Button';
import { useState, useEffect } from 'react';
import LogoutButton from './LogoutButton';
import { connectMetaMask, findMetaMaskAccount } from '../utils/metamask';

const RoleDashboard = ({ title, children }) => {
  const [currentAccount, setCurrentAccount] = useState('');

  useEffect(() => {
    findMetaMaskAccount().then((account) => {
      if (account !== null) {
        setCurrentAccount(account);
      }
    });
  }, []);

  const handleConnectWallet = async () => {
    try {
      const account = await connectMetaMask();
      if (account) {
        setCurrentAccount(account);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="role-container">
      <div className="role-container-box">
        <LogoutButton />

        <h2>Welcome:</h2>
        <h1>{title}</h1>

        {children}

        {!currentAccount && (
          <Button
            className="btns"
            buttonStyle="btn--long"
            buttonSize="btn--large"
            onClick={handleConnectWallet}
          >
            Connect Wallet
          </Button>
        )}
      </div>
    </div>
  );
};

export default RoleDashboard;
