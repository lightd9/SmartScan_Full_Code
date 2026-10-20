import { Button } from '../Button';
import { Link } from 'react-router-dom';
import RoleDashboard from '../RoleDashboard';

const Manufacturer = () => {
    return (
        <RoleDashboard title="Manufacturer">
            <Link to="/profile">
                <Button className="btns" buttonStyle='btn--long' buttonSize='btn--large'>Check Profile</Button>
            </Link>

            <Link to="/add-product">
                <Button className="btns" buttonStyle='btn--long' buttonSize='btn--large'>Add Product</Button>
            </Link>
        </RoleDashboard>
    );
}

export default Manufacturer;
