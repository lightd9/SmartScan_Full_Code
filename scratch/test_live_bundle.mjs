async function checkLiveBundle() {
    const res = await fetch('https://smart-scan-ten.vercel.app/assets/index-B3tbcME7.js');
    const text = await res.text();
    console.log(`Main bundle length: ${text.length} bytes`);
    
    // Find all dynamic imports
    const matches = [...text.matchAll(/__vite__mapDeps\(\[[^\]]*\]\)/g)];
    const assetMatches = [...text.matchAll(/"\/assets\/[^"]+\.js"/g)].map(m => m[0].replace(/"/g, ''));
    console.log(`Found ${assetMatches.length} asset references`);
    
    let foundBatch = false;
    let foundLabel = false;

    // Check all chunks
    for (const asset of assetMatches) {
        const chunkRes = await fetch(`https://smart-scan-ten.vercel.app${asset}`);
        const chunkText = await chunkRes.text();
        if (chunkText.includes('Continuous Batch Scan Mode') || chunkText.includes('batchQueue')) {
            console.log(`✅ Found Batch Mode in ${asset}`);
            foundBatch = true;
        }
        if (chunkText.includes('thermal-packaging-label') || chunkText.includes('ThermalPackagingLabelModal') || chunkText.includes('Packaging Label')) {
            console.log(`✅ Found Thermal Packaging Label in ${asset}`);
            foundLabel = true;
        }
    }

    if (!foundBatch || !foundLabel) {
        // Also check if text is directly in main bundle
        if (text.includes('Continuous Batch Scan Mode') || text.includes('batchQueue')) foundBatch = true;
        if (text.includes('thermal-packaging-label')) foundLabel = true;
    }

    console.log(`Status: Batch Mode Live: ${foundBatch}, Thermal Label Live: ${foundLabel}`);
}

checkLiveBundle().catch(console.error);

