// src/deployer-loop.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const solc = require("solc");

// --- تنظیمات کلی ---
const RPC_URL = "https://testnet-rpc.monad.xyz";
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const MIN_BALANCE_REQUIRED = "0.05"; // حداقل موجودی لازم برای اجرای دیپلوی

/**
 * تابعی برای کامپایل کردن قراردادهای Solidity از سورس
 */
function compileContracts() {
    console.log("در حال خواندن سورس کد قراردادها از پوشه 'contracts'...");
    const contractsPath = path.resolve(__dirname, '..', 'contracts');
    const simpleStoragePath = path.join(contractsPath, 'SimpleStorage.sol');
    const myNftPath = path.join(contractsPath, 'MyNFT.sol');

    const simpleStorageSource = fs.readFileSync(simpleStoragePath, 'utf8');
    const myNftSource = fs.readFileSync(myNftPath, 'utf8');

    console.log("در حال آماده‌سازی ورودی برای کامپایلر...");
    const compilerInput = {
        language: 'Solidity',
        sources: {
            'SimpleStorage.sol': { content: simpleStorageSource },
            'MyNFT.sol': { content: myNftSource }
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['abi', 'evm.bytecode.object']
                }
            }
        }
    };
    
    // تابعی برای پیدا کردن import های OpenZeppelin در پوشه node_modules
    function findImports(importPath) {
        try {
            const contractPath = require.resolve(importPath, { paths: [path.resolve(__dirname, '..', 'node_modules')] });
            return { contents: fs.readFileSync(contractPath, 'utf8') };
        } catch (error) {
            return { error: `File not found: ${importPath}` };
        }
    }

    console.log("در حال کامپایل کردن قراردادها... این ممکن است چند لحظه طول بکشد.");
    const compiledOutput = JSON.parse(solc.compile(JSON.stringify(compilerInput), { import: findImports }));

    // بررسی وجود خطا در کامپایل
    if (compiledOutput.errors) {
        let hasError = false;
        compiledOutput.errors.forEach((error) => {
            if (error.severity === 'error') {
                console.error(`❌ خطای کامپایل: ${error.formattedMessage}`);
                hasError = true;
            } else {
                console.warn(`⚠️ هشدار کامپایل: ${error.formattedMessage}`);
            }
        });
        if (hasError) {
            throw new Error("کامپایل سالیدیتی ناموفق بود.");
        }
    }

    console.log("✅ قراردادها با موفقیت کامپایل شدند.");

    const simpleStorageArtifacts = compiledOutput.contracts['SimpleStorage.sol']['SimpleStorage'];
    const myNftArtifacts = compiledOutput.contracts['MyNFT.sol']['MyNFT'];

    return {
        simpleStorage: {
            abi: simpleStorageArtifacts.abi,
            bytecode: '0x' + simpleStorageArtifacts.evm.bytecode.object
        },
        myNft: {
            abi: myNftArtifacts.abi,
            bytecode: '0x' + myNftArtifacts.evm.bytecode.object
        }
    };
}

/**
 * تابعی برای دیپلوی کردن یک قرارداد
 */
async function deployContract(wallet, abi, bytecode, contractName) {
    console.log(`\n-- شروع دیپلوی قرارداد: ${contractName} --`);
    const contractFactory = new ethers.ContractFactory(abi, bytecode, wallet);
    try {
        const contract = await contractFactory.deploy();
        const deployTx = contract.deploymentTransaction();
        console.log(`  تراکنش دیپلوی برای ${contractName} ارسال شد. هش: ${deployTx.hash}`);
        console.log("  در انتظار تایید تراکنش...");
        await contract.waitForDeployment();
        const contractAddress = await contract.getAddress();
        console.log(`  ✅ قرارداد ${contractName} با موفقیت در آدرس زیر دیپلوی شد:`);
        console.log(`  ${contractAddress}`);
        return contractAddress;
    } catch (error) {
        console.error(`  ❌ خطا در هنگام دیپلوی ${contractName}:`, error.message);
        return null;
    }
}

// --- تابع اصلی اجرایی ---
async function main() {
    console.log("--- شروع اسکریپت دیپلوی حلقه‌ای ---");

    if (!PRIVATE_KEY) {
        console.error("خطا: کلید خصوصی WALLET_PRIVATE_KEY در GitHub Secrets تنظیم نشده است!");
        process.exit(1);
    }
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`کیف پول متصل شد: ${wallet.address}`);

    try {
        console.log("در حال بررسی موجودی کیف پول...");
        const balance = await provider.getBalance(wallet.address);
        const minBalance = ethers.parseEther(MIN_BALANCE_REQUIRED);

        console.log(`موجودی فعلی: ${ethers.formatEther(balance)} MON`);
        console.log(`حداقل موجودی مورد نیاز: ${MIN_BALANCE_REQUIRED} MON`);

        if (balance < minBalance) {
            console.log(`❌ موجودی کافی نیست (کمتر از ${MIN_BALANCE_REQUIRED} MON). عملیات دیپلوی لغو شد.`);
            process.exit(0); // خروج موفق، چون این یک شرط است نه خطا
        }
        console.log("✅ موجودی کافی است. شروع فرآیند کامپایل و دیپلوی...");

        // کامپایل کردن قراردادها
        const compiledContracts = compileContracts();

        // ۱. دیپلوی قرارداد SimpleStorage
        const simpleStorageAddress = await deployContract(wallet, compiledContracts.simpleStorage.abi, compiledContracts.simpleStorage.bytecode, "SimpleStorage");
        if (!simpleStorageAddress) throw new Error("دیپلوی SimpleStorage ناموفق بود.");

        console.log("\n... انتظار 5 ثانیه قبل از دیپلوی بعدی ...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // ۲. دیپلوی قرارداد MyNFT
        const myNftAddress = await deployContract(wallet, compiledContracts.myNft.abi, compiledContracts.myNft.bytecode, "MyNFT");
        if (!myNftAddress) throw new Error("دیپلوی MyNFT ناموفق بود.");

        console.log("\n🎉🎉🎉 هر دو قرارداد با موفقیت دیپلوی شدند! 🎉🎉🎉");

    } catch (error) {
        console.error("\nخطایی کلی در اجرای اسکریپت دیپلوی رخ داد:", error.message);
        process.exit(1);
    }
}

main();
