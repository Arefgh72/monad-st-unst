// src/4-unstake-script.js

const { ethers } = require("ethers");

// --- اطلاعات نهایی و تایید شده پروژه ---
const RPC_URL = "https://testnet-rpc.monad.xyz";
const PROXY_CONTRACT_ADDRESS = "0x3a98250F98Dd388C211206983453837C8365BDc1";

// --- ABI نهایی و کامل با هر دو تابع صحیح ---
const IMPLEMENTATION_ABI = [
    "function deposit(uint256 amount, address receiver) public payable",
    "function redeem(uint256 amount, address receiver, address owner)"
];

// --- تنظیمات اسکریپت ---
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const AMOUNT_TO_UNSTAKE = "0.001"; // مقداری که می‌خواهیم آن-استیک کنیم
const MIN_BALANCE_REQUIRED = "0.01"; // حداقل موجودی لازم در کیف پول برای اجرا

async function main() {
    // ۱. چک کردن کلید خصوصی
    if (!PRIVATE_KEY) {
        console.error("خطا: کلید خصوصی WALLET_PRIVATE_KEY در GitHub Secrets تنظیم نشده است!");
        process.exit(1);
    }

    console.log("در حال اتصال به شبکه موناد...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`کیف پول با موفقیت متصل شد. آدرس: ${wallet.address}`);

    try {
        // ۲. چک کردن موجودی کیف پول (قابلیت جدید)
        console.log("در حال بررسی موجودی کیف پول قبل از آن-استیک...");
        const balanceWei = await provider.getBalance(wallet.address);
        const minBalanceWei = ethers.parseEther(MIN_BALANCE_REQUIRED);

        console.log(`موجودی فعلی: ${ethers.formatEther(balanceWei)} MON`);
        console.log(`حداقل موجودی مورد نیاز: ${MIN_BALANCE_REQUIRED} MON`);

        if (balanceWei < minBalanceWei) {
            console.log("❌ موجودی کافی نیست. عملیات آن-استیک برای جلوگیری از تراکنش ناموفق، لغو شد.");
            return;
        }
        console.log("✅ موجودی کافی است. ادامه فرآیند...");

        // ۳. اتصال به قرارداد و اجرای تراکنش
        const contract = new ethers.Contract(PROXY_CONTRACT_ADDRESS, IMPLEMENTATION_ABI, wallet);
        console.log(`در حال آماده‌سازی تراکنش برای آن-استیک کردن ${AMOUNT_TO_UNSTAKE} توکن...`);

        const amountInWei = ethers.parseEther(AMOUNT_TO_UNSTAKE);

        // فراخوانی تابع redeem با ورودی‌های صحیح
        const tx = await contract.redeem(amountInWei, wallet.address, wallet.address);

        console.log(`تراکنش آن-استیک (Redeem) ارسال شد. هش: ${tx.hash}`);
        console.log("در انتظار تایید تراکنش...");

        await tx.wait();
        
        console.log("✅ عملیات آن-استیک با موفقیت انجام شد!");

    } catch (error) {
        console.error("❌ مشکلی در حین فرآیند آن-استیک کردن پیش آمد:", error.message);
        process.exit(1);
    }
}

main();
