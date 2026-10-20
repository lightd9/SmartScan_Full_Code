import '../../css/Role.css'
import { LinkButton } from '../LinkButton';
import LogoutButton from '../LogoutButton';

const Admin = () => {
    return (
        <div className="role-container">
            <div className="role-container-box">

                <LogoutButton />

                <h2>Welcome:</h2>
                <h1>ADMIN</h1>
                <LinkButton to="/add-account" className="btns" buttonStyle='btn--long' buttonSize='btn--large'>Add Account</LinkButton>
                <LinkButton to="/manage-account" className="btns" buttonStyle='btn--long' buttonSize='btn--large'>Manage Accounts</LinkButton>

            </div>
        </div>
    );
}

export default Admin;
