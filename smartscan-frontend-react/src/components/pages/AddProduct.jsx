import { Box, Paper, Typography } from '@mui/material';
import bgImg from '../../img/bg.png';
import { TextField, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { ethers } from "ethers";
import axios from '../../api/axios';
import QRCode from 'qrcode.react';
import dayjs from 'dayjs';
import useAuth from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import Geocode from "react-geocode";
import { CONTRACT_ADDRESS, CONTRACT_ABI, SEPOLIA_CHAIN_ID, SEPOLIA_RPC_URL } from '../../config/contract';


const AddProduct = () => {    

    const [serialNumber, setSerialNumber] = useState("");
    const [name, setName] = useState("");
    const [brand, setBrand] = useState("");
    const [description, setDescription] = useState("");
    const [image, setImage] = useState({
        file: [],
        filepreview: null
    });
    const [qrData, setQrData] = useState('');
    const [manuDate, setManuDate] = useState('');
    const [manuLatitude, setManuLatitude] = useState("");
    const [manuLongtitude, setManuLongtitude] = useState("");
    const [manuName, setManuName] = useState("");
    const [loading, setLoading] = useState("");
    const [manuLocation, setManuLocation] = useState("");
    const [isUnique, setIsUnique] = useState(true);

    const { auth } = useAuth();
    const navigate = useNavigate();
    
    useEffect(() => {
        getUsername();
        getCurrentTimeLocation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const apiKey = process.env.REACT_APP_GEOCODING_API_KEY;
        if (!apiKey || !manuLatitude || !manuLongtitude) {
            return;
        }
        Geocode.setApiKey(apiKey);

        Geocode.fromLatLng(manuLatitude, manuLongtitude).then(
            (response) => {
              const address = response.results[0].formatted_address;
              let city, state, country;
              for (let i = 0; i < response.results[0].address_components.length; i++) {
                for (let j = 0; j < response.results[0].address_components[i].types.length; j++) {
                  switch (response.results[0].address_components[i].types[j]) {
                    case "locality":
                      city = response.results[0].address_components[i].long_name;
                      break;
                    case "administrative_area_level_1":
                      state = response.results[0].address_components[i].long_name;
                      break;
                    case "country":
                      country = response.results[0].address_components[i].long_name;
                      break;
                    default:
                      break;
                  }
                }
              }              
              setManuLocation(address.replace(/,/g, ';'));
              console.log("city, state, country: ", city, state, country);
              console.log("address:", address);
            },
            (error) => {
              console.error(error);
            }
          );

    }, [manuLatitude, manuLongtitude]);

    const generateQRCode = async (serialNumber) => {
        // const qrCode = await productContract.getProduct(serialNumber);
        const data = CONTRACT_ADDRESS + ',' + serialNumber
        setQrData(data);
        console.log("QR Code: ", qrData);

    }

    const downloadQR = () => {
        const canvas = document.getElementById("QRCode");
        const pngUrl = canvas
          .toDataURL("image/png")
          .replace("image/png", "image/octet-stream");
        let downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `${serialNumber}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      };

    
    const handleBack = () => {
        navigate(-1)
    }

    const handleImage = async (e) => {
        setImage({
            ...image,
            file: e.target.files[0],
            filepreview: URL.createObjectURL(e.target.files[0])
        })
    }

    const getUsername = async (e) => {
        await axios.get(`/profile/${auth.user}`)
            .then(res => {
                setManuName(res?.data[0].name);

            })
    }


    // to upload image
    const uploadImage = async (image) => {
        if (!image?.file) {
            return "";
        }
        const data = new FormData();
        data.append("image", image.file);

        const res = await axios.post("/upload/product", data, {
            headers: { "Content-Type": "multipart/form-data" }
        });

        if (res.data?.success !== 1) {
            throw new Error("Image upload failed");
        }
        return res.data.fileName;
    }

const registerProduct = async (e, imageName) => {
    e.preventDefault();

    try {
        const { ethereum } = window;

        if (ethereum) {
            // 🔥 Request account access FIRST
            const accounts = await ethereum.request({ method: "eth_requestAccounts" });
            const account = accounts[0];

            const provider = new ethers.providers.Web3Provider(ethereum);
            const signer = provider.getSigner();
            const productContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            console.log("Connected account:", account);
            console.log("Creating transaction...");

            // write transactions
            const registerTxn = await productContract.registerProduct(
                name,
                brand,
                serialNumber,
                description.replace(/,/g, ';'),
                imageName,
                manuName,
                manuLocation,
                manuDate.toString()
            );

            console.log("Mining (Registering Product) ...", registerTxn.hash);
            setLoading(`Mining (Register Product) ... ${registerTxn.hash}`);

            // Save the hash before waiting so interrupted browser/RPC sessions
            // can be recovered by the reconciliation worker.
            await axios.patch(`/product/${encodeURIComponent(serialNumber)}/chain-status`, {
                status: "pending_chain",
                txHash: registerTxn.hash,
                chainId: "11155111",
            });

            await registerTxn.wait();
            console.log("Mined (Register Product) --", registerTxn.hash);
            setLoading(`Mined (Register Product) -- ${registerTxn.hash}`);

            generateQRCode(serialNumber);

            const product = await productContract.getProduct(serialNumber);
            console.log("Retrieved product...", product);

            setLoading("");
            return registerTxn.hash;

        } else {
            throw new Error("MetaMask not detected");
        }
    } catch (error) {
        console.error("Error registering product:", error);
            throw error;
    }
};

    const getCurrentTimeLocation = () => {
        setManuDate(dayjs().unix())
        navigator.geolocation.getCurrentPosition(function(position) {
            setManuLatitude(position.coords.latitude);
            setManuLongtitude(position.coords.longitude);
          });
    }   

    const addProductDB = async (e) => {
        try {
            const profileData = JSON.stringify({
                "serialNumber": serialNumber,
                "name": name,
                "brand": brand,
              });

            const res = await axios.post('/addproduct', profileData,
                {
                    headers: {'Content-Type': 'application/json'},
                });
            
            console.log(JSON.stringify(res.data));
            


        } catch (err) {
            console.log(err);
        }
    }

const checkUnique = async () => {
    try {
        const res = await axios.get("/product/serialNumber");

        const existingSerialNumbers = res.data.map((product) => product.serialnumber);
        const isDuplicate = existingSerialNumbers.includes(serialNumber);

        setIsUnique(!isDuplicate);
        return !isDuplicate; // return result to be used in handleSubmit
    } catch (err) {
        console.error("Error checking uniqueness:", err);
        alert("Unable to verify the serial number. Please try again.");
        return false;
    }
};

const switchToSepolia = async () => {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }], // Sepolia
        });
        console.log("Switched to Sepolia successfully.");
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: SEPOLIA_CHAIN_ID,
                        chainName: 'Sepolia Test Network',
                        nativeCurrency: {
                            name: 'SepoliaETH',
                            symbol: 'ETH',
                            decimals: 18,
                        },
                        rpcUrls: [SEPOLIA_RPC_URL],
                        blockExplorerUrls: ['https://sepolia.etherscan.io'],
                    }],
                });
            } catch (addError) {
                console.error("Failed to add Sepolia:", addError);
            }
        } else {
            console.error("Failed to switch to Sepolia:", switchError);
        }
    }
};



const handleSubmit = async (e) => {
    e.preventDefault();

    if (!serialNumber || !name || !brand) {
        alert("Please fill in the serial number, name and brand.");
        return;
    }

    const unique = await checkUnique(); // wait for uniqueness check to complete

    if (!unique) {
        alert("Serial number already exists. Please enter a unique one.");
        return;
    }

    try {
        const imageName = await uploadImage(image);
        await addProductDB(e);            // ensure DB operation is complete
        setLoading("Please pay the transaction fee to update the product details...");
        await switchToSepolia(); // ensure you're on the correct network
        const txHash = await registerProduct(e, imageName); // blockchain registration
        await axios.patch(`/product/${encodeURIComponent(serialNumber)}/chain-status`, {
            status: "confirmed",
            txHash,
            chainId: "11155111",
        });
    } catch (err) {
        console.error("Error adding product:", err);
        try {
            await axios.patch(`/product/${encodeURIComponent(serialNumber)}/chain-status`, {
                status: "failed",
                failureReason: err?.message || "Blockchain registration failed",
            });
        } catch (statusError) {
            console.error("Unable to record failed chain status:", statusError);
        }
        setLoading("");
        alert("Something went wrong while adding the product. Please try again.");
    }
};


    return (
        <Box sx={{
            backgroundImage: `url(${bgImg})`,
            minHeight: "80vh",
            backgroundRepeat: "no-repeat",
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundSize: 'cover',
            zIndex: -2,
            overflowY: "scroll"
        }}>
            <Paper elevation={3} sx={{ width: "400px", margin: "auto", marginTop: "10%", marginBottom: "10%", padding: "3%", backgroundColor: "#e3eefc" }}>
                <Typography
                    variant="h2"
                    sx={{
                        textAlign: "center", marginBottom: "3%",
                        fontFamily: 'Gambetta', fontWeight: "bold", fontSize: "2.5rem"
                    }}
                >
                    Add Product</Typography>
                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        error={!isUnique}
                        helperText={!isUnique ? "Serial Number already exists" : ""}
                        id="outlined-basic"
                        margin="normal"
                        label="Serial Number"
                        variant="outlined"
                        onChange={(e) => setSerialNumber(e.target.value)}
                        value={serialNumber}
                    />
                    
                    <TextField
                        fullWidth
                        id="outlined-basic"
                        margin="normal"
                        label="Name"
                        variant="outlined"
                        onChange={(e) => setName(e.target.value)}
                        value={name}
                    />

                    <TextField
                        fullWidth
                        id="outlined-basic"
                        margin="normal"
                        label="Brand"
                        variant="outlined"
                        onChange={(e) => setBrand(e.target.value)}
                        value={brand}
                    />

                    <TextField
                        fullWidth
                        id="outlined-basic"
                        margin="normal"
                        label="Description"
                        variant="outlined"
                        multiline
                        minRows={2}
                        onChange={(e) => setDescription(e.target.value)}
                        value={description}
                    />                        


                    <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        sx={{ marginTop: "3%", marginBottom: "3%" }}
                    >
                        Upload Image
                        <input
                            type="file"
                            hidden
                            onChange={handleImage}
                        />
                    </Button>

                    {image.filepreview !== null ?
                        <img src={image.filepreview} alt="preview" style={{ width: "100%", height: "100%" }} />
                        : null}

                    {qrData !== "" ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '3%' }}>
                        <QRCode 
                            value={qrData}
                            id="QRCode" />
                
                    </div> : null}

                    {qrData !== "" ? <div style={{ display: 'flex',  justifyContent: 'center', alignItems: 'center', marginTop: '3%' }}>
                        <Button
                            variant="outlined"
                            component="label"
                            fullWidth
                            sx={{ marginTop: "3%", marginBottom: "3%" }}                            
                            onClick={downloadQR}
                        >
                            Download
                        </Button>
      
                    </div> : null}

                    {loading === "" ? null
                        : <Typography
                            variant="body2"
                            sx={{
                                textAlign: "center", marginTop: "3%"
                            }}
                        >
                            {loading}
                        </Typography>
                    }

                    <Button
                        variant="contained"
                        type="submit"
                        sx={{ width: "100%", marginTop: "3%", backgroundColor: '#98b5d5', '&:hover': { backgroundColor: '#618dbd' } }}
                        onClick={getCurrentTimeLocation}
                    >
                        Add Product
                    </Button>

                    <Box
                        sx={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "center",
                        }}
                    >


                        <Button
                            onClick={handleBack}
                            sx={{
                                marginTop: "5%",
                            }}
                        >
                            Back
                        </Button>

                    </Box>                    

                </form>

            </Paper>

        </Box>
    );
}

export default AddProduct;
