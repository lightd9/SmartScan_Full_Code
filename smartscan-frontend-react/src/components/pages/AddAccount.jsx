import React, { useState, useEffect, useRef } from 'react';
import { TextField, Box, Paper, Typography, Autocomplete, Button } from '@mui/material';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';
import axios from '../../api/axios';
import { useNavigate } from 'react-router-dom';

const options = ["manufacturer", "supplier", "retailer"]

const AddAccount = () => {
    const [user, setUser] = useState('');
    const [pwd, setPwd] = useState('');
    const [pwd2, setPwd2] = useState('');
    const [role, setRole] = useState(options[0]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [website, setWebsite] = useState('');
    const [location, setLocation] = useState('');
    const [errMsg, setErrMsg] = useState('');
    const [image, setImage] = useState({
        file: [],
        filepreview: null
    });
    
    const errRef = useRef();
    const navigate = useNavigate()

    useEffect(() => {
        setErrMsg('');
    }, [user, pwd]);

    const handleImage = async (e) => {
        setImage({
            ...image,
            file: e.target.files[0],
            filepreview: URL.createObjectURL(e.target.files[0])
        })
    }

    // to upload image
const uploadImage = async (image) => {
  if (!image?.file) {
    return "";
  }
  const data = new FormData();
  data.append("image", image.file);

  const res = await axios.post("/upload/profile", data, {
    headers: { "Content-Type": "multipart/form-data" }
  });

  if (res.data?.success !== 1) {
    throw new Error("Image upload failed");
  }
  return res.data.fileName;
};


    const handleBack = () => {
        navigate(-1)
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!user || !pwd || !name) {
            setErrMsg('Please fill in the username, password and name.');
            return;
        }

        if (pwd.length < 12) {
            setErrMsg('Choose a password with at least 12 characters.');
            return;
        }

        if (pwd !== pwd2) {
            setErrMsg('Passwords do not match.');
            return;
        }

        try {
            const fileName = await uploadImage(image);

            await axios.post('/addaccount', {
                username: user,
                password: pwd,
                name,
                description,
                website,
                location,
                image: fileName,
                role
            });

            setUser('');
            setPwd('');
            setPwd2('');
            setRole(options[0]);
            setName('');
            setDescription('');
            setWebsite('');
            setLocation('');
            setImage({
                file: [],
                filepreview: null
            });

            setErrMsg('');
            alert('Account created successfully.');
        } catch (err) {
            if (!err?.response) {
                setErrMsg('Server is down. Please try again later.');
            } else if (err.response?.status === 409) {
                setErrMsg('That username is already taken.');
            } else if (err.response?.status === 400) {
                setErrMsg('Please check the details you entered.');
            } else if (err.response?.status === 401 || err.response?.status === 403) {
                setErrMsg('You are not authorized to add accounts.');
            } else {
                setErrMsg('Failed to add the account. Please try again later.');
            }
            errRef.current.focus();
        }
    };


    return (
        <DashboardShell>
            <GreetingBanner
                title="Account Provisioning Studio"
                subtitle="Onboard enterprise manufacturers, suppliers, and retail partners"
                metrics={[
                    {
                        icon: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>ROLE</span>,
                        value: (role || 'Manufacturer').toUpperCase(),
                        label: 'Selected Entity',
                    },
                    {
                        icon: <span style={{ color: '#10B981', fontWeight: 700 }}>AUTH</span>,
                        value: 'Scrypt + JWT',
                        label: 'Security Layer',
                    },
                    {
                        icon: <span style={{ color: '#2563EB', fontWeight: 700 }}>EVM</span>,
                        value: 'IdenteefiV2',
                        label: 'Smart Contract Ready',
                    },
                ]}
            />

            {errMsg && (
                <div
                    ref={errRef}
                    role="alert"
                    tabIndex={-1}
                    style={{
                        padding: '12px 18px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--status-red-bg)',
                        color: 'var(--status-red-text)',
                        fontSize: '13px',
                        fontWeight: 600,
                    }}
                >
                    {errMsg}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                <div className="dashboard-grid-dual">
                    {/* Left Column: Account Credentials */}
                    <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            Credentials & Role
                        </h2>

                        <TextField
                            fullWidth
                            id="outlined-username"
                            label="Username"
                            variant="outlined"
                            required
                            onChange={(e) => setUser(e.target.value)}
                            value={user}
                        />

                        <Autocomplete
                            disablePortal
                            id="combo-box-role"
                            options={options}
                            fullWidth
                            value={role}
                            onChange={(event, newRole) => {
                                setRole(newRole);
                            }}
                            renderInput={(params) => (
                                <TextField {...params} fullWidth label="Assigned Role" variant="outlined" />
                            )}
                        />

                        <TextField
                            fullWidth
                            id="outlined-password"
                            label="Password"
                            type="password"
                            variant="outlined"
                            required
                            inputProps={{ minLength: 12, maxLength: 200 }}
                            helperText="Use at least 12 characters."
                            onChange={(e) => setPwd(e.target.value)}
                            value={pwd}
                        />

                        <TextField
                            fullWidth
                            id="outlined-confirm-password"
                            label="Confirm Password"
                            type="password"
                            variant="outlined"
                            required
                            inputProps={{ minLength: 12, maxLength: 200 }}
                            onChange={(e) => setPwd2(e.target.value)}
                            value={pwd2}
                        />

                        {pwd && pwd2 && pwd !== pwd2 && (
                            <div style={{ color: 'var(--status-red-text)', fontSize: '12.5px', fontWeight: 600 }}>
                                Passwords do not match
                            </div>
                        )}
                    </div>

                    {/* Right Column: Business Profile */}
                    <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            Organization Profile
                        </h2>

                        <TextField
                            fullWidth
                            id="outlined-business-name"
                            label="Company / Business Name"
                            variant="outlined"
                            required
                            inputProps={{ maxLength: 100 }}
                            helperText="Used for on-chain role identity (max 100 bytes)."
                            onChange={(e) => setName(e.target.value)}
                            value={name}
                        />

                        <TextField
                            fullWidth
                            id="outlined-business-desc"
                            label="Business Description"
                            variant="outlined"
                            multiline
                            minRows={2}
                            onChange={(e) => setDescription(e.target.value)}
                            value={description}
                        />

                        <TextField
                            fullWidth
                            id="outlined-website"
                            label="Official Website"
                            variant="outlined"
                            onChange={(e) => setWebsite(e.target.value)}
                            value={website}
                        />

                        <TextField
                            fullWidth
                            id="outlined-location"
                            label="Headquarters / Physical Location"
                            variant="outlined"
                            onChange={(e) => setLocation(e.target.value)}
                            value={location}
                        />

                        <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                                Organization Logo / Avatar
                            </label>
                            <Button variant="outlined" component="label" fullWidth sx={{ textTransform: 'none', borderRadius: '10px' }}>
                                Upload Logo Image
                                <input type="file" hidden accept="image/*" onChange={handleImage} />
                            </Button>
                            {image.filepreview && (
                                <div style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)', maxHeight: 120, display: 'flex', justifyContent: 'center' }}>
                                    <img src={image.filepreview} alt="Logo preview" style={{ maxHeight: '100%', objectFit: 'contain' }} />
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <button
                                type="submit"
                                className="btn-primary-action"
                                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
                            >
                                Provision Enterprise Account
                            </button>

                            <button
                                type="button"
                                className="btn-secondary-action"
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={handleBack}
                            >
                                Cancel & Return to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </DashboardShell>
    );
}

export default AddAccount;
