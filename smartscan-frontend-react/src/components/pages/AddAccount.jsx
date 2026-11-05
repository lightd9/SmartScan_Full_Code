import React, { useState, useEffect, useRef } from 'react';
import { TextField, Box, Paper, Typography, Autocomplete, Button, Alert } from '@mui/material';
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
    const [successMsg, setSuccessMsg] = useState('');
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
        const file = image?.file;
        if (!file || (Array.isArray(file) && file.length === 0) || !(file instanceof File || file instanceof Blob)) {
            return "";
        }
        const data = new FormData();
        data.append("image", file);

        const res = await axios.post("/upload/profile", data, {
            headers: { "Content-Type": "multipart/form-data" }
        });

        if (res.data?.success !== 1) {
            throw new Error(res.data?.error || "Image upload failed");
        }
        return res.data.fileName;
    };


    const handleBack = () => {
        navigate(-1)
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanUser = user.trim();
        const cleanName = name.trim();
        const cleanDesc = description.trim();
        const cleanWebsite = website.trim();
        const cleanLoc = location.trim();

        if (!cleanUser) {
            setErrMsg('Please enter a username.');
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (cleanUser.length > 50) {
            setErrMsg(`Username cannot exceed 50 characters (currently ${cleanUser.length} characters).`);
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (!role || !options.includes(role)) {
            setErrMsg(`Please select an assigned role (${options.join(', ')}).`);
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (!pwd) {
            setErrMsg('Please enter a password.');
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (pwd.length < 12) {
            setErrMsg(`Password must have at least 12 characters (currently ${pwd.length} characters).`);
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (pwd.length > 200) {
            setErrMsg('Password cannot exceed 200 characters.');
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (pwd !== pwd2) {
            setErrMsg('Passwords do not match. Please verify both password entries.');
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (!cleanName) {
            setErrMsg('Company / Business Name is required.');
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        const nameBytes = new TextEncoder().encode(cleanName).length;
        if (nameBytes > 100) {
            setErrMsg(`Company / Business Name cannot exceed 100 UTF-8 bytes for on-chain identity (currently ${nameBytes} bytes).`);
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (cleanDesc.length > 500) {
            setErrMsg(`Business Description cannot exceed 500 characters (currently ${cleanDesc.length} characters).`);
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (cleanWebsite.length > 500) {
            setErrMsg(`Website URL cannot exceed 500 characters (currently ${cleanWebsite.length} characters).`);
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (cleanLoc.length > 500) {
            setErrMsg(`Physical Location cannot exceed 500 characters (currently ${cleanLoc.length} characters).`);
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        try {
            const fileName = await uploadImage(image);

            const res = await axios.post('/addaccount', {
                username: cleanUser,
                password: pwd,
                name: cleanName,
                description: cleanDesc,
                website: cleanWebsite,
                location: cleanLoc,
                image: fileName,
                role
            });

            const createdWallet = res.data?.walletAddress;

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
            setSuccessMsg(
                createdWallet
                    ? `Enterprise account for @${cleanUser} created! Encapsulated operational wallet (${createdWallet}) automatically provisioned, funded with gas, and linked.`
                    : `Enterprise account for @${cleanUser} created successfully!`
            );
        } catch (err) {
            setSuccessMsg('');
            const serverError = err.response?.data?.error || err.response?.data?.message;
            if (serverError) {
                setErrMsg(serverError);
            } else if (!err?.response) {
                setErrMsg('Server is unreachable. Please check your network connection.');
            } else if (err.response?.status === 409) {
                setErrMsg(`Username "${cleanUser}" is already taken. Please choose another username.`);
            } else if (err.response?.status === 401 || err.response?.status === 403) {
                setErrMsg('You are not authorized to provision accounts. Please ensure you are logged in as an Administrator.');
            } else {
                setErrMsg(err.message || 'Failed to add the account. Please review your entries.');
            }
            errRef.current?.scrollIntoView({ behavior: 'smooth' });
            errRef.current?.focus();
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

            {successMsg && (
                <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccessMsg('')}>
                    {successMsg}
                </Alert>
            )}

            {errMsg && (
                <Alert severity="error" ref={errRef} tabIndex={-1} sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setErrMsg('')}>
                    {errMsg}
                </Alert>
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
                            inputProps={{ maxLength: 50 }}
                            helperText="Unique login identifier (1-50 characters)."
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
                                <TextField {...params} fullWidth label="Assigned Role" variant="outlined" helperText="Determines supply chain permissions & smart contract role." />
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
                            error={Boolean(pwd && pwd.length < 12)}
                            helperText={pwd && pwd.length < 12 ? `Need ${12 - pwd.length} more character${12 - pwd.length > 1 ? 's' : ''} (min 12).` : "Minimum 12 characters required."}
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
                            error={Boolean(pwd && pwd2 && pwd !== pwd2)}
                            helperText={pwd && pwd2 && pwd !== pwd2 ? "Passwords do not match." : "Re-enter the same password."}
                            onChange={(e) => setPwd2(e.target.value)}
                            value={pwd2}
                        />
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

                        <Box sx={{ border: '1px dashed var(--color-border)', borderRadius: '12px', p: 1.75, backgroundColor: 'var(--color-surface-hover)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                                    Organization Logo / Avatar <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(Optional)</span>
                                </Typography>
                                {image.filepreview && (
                                    <Button
                                        size="small"
                                        color="error"
                                        sx={{ textTransform: 'none', fontSize: '11px', p: 0, minWidth: 'auto', fontWeight: 600 }}
                                        onClick={() => setImage({ file: [], filepreview: null })}
                                    >
                                        Remove Logo
                                    </Button>
                                )}
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box
                                    sx={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: '10px',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: '#FFFFFF',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                    }}
                                >
                                    {image.filepreview ? (
                                        <img
                                            src={image.filepreview}
                                            alt="Logo preview"
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                    ) : (
                                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8' }}>
                                            {(name || user || 'ORG').slice(0, 3).toUpperCase()}
                                        </Typography>
                                    )}
                                </Box>

                                <Box sx={{ flex: 1 }}>
                                    <Button
                                        variant="outlined"
                                        component="label"
                                        size="small"
                                        sx={{
                                            textTransform: 'none',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            py: 0.4,
                                            px: 1.5,
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-text-main)',
                                        }}
                                    >
                                        {image.filepreview ? 'Change Logo' : 'Select Logo (Optional)'}
                                        <input type="file" hidden accept="image/*" onChange={handleImage} />
                                    </Button>
                                    <Typography variant="caption" sx={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '10.5px', mt: 0.3 }}>
                                        Optional PNG/JPG. Not required to create account.
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

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
