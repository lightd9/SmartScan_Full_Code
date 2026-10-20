import { Button } from '../Button';
import { Link } from 'react-router-dom';
import RoleDashboard from '../RoleDashboard';

const Supplier = () => {
    return (
        <RoleDashboard title="Supplier">
            <Link to="/profile">
                <Button className="btns" buttonStyle='btn--long' buttonSize='btn--large'>Check Profile</Button>
            </Link>

            <Link to="/scanner">
                <Button className="btns" buttonStyle='btn--long' buttonSize='btn--large'>Update Product</Button>
            </Link>
        </RoleDashboard>
    );
}

export default Supplier;
