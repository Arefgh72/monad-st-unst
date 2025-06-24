// src/tip.js

const { ethers } = require("ethers");

// --- اطلاعات قرارداد و شبکه ---
const RPC_URL = "https://testnet-rpc.monad.xyz";
const TIP_CONTRACT_ADDRESS = "0xd3E51bfEE95E31760B671AfEF9763fB2CF4A375a";
const TIP_CONTRACT_ABI = [
    // این تابع بر اساس ABI که فرستادید تعریف شده است
    "function tip(address recipient) public payable"
];

// --- تنظیمات اسکریپت ---
// این اسکریپت از کیف پول اصلی شما استفاده می‌کند
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

const TARGET_ADDRESS = "0xE7E7Ca7C192E5342dd98249F51E82E90ee6c9A7c"; // آدرس کیف پول فرعی به عنوان مقصد
const AMOUNT_TO_TIP = "0.01"; // مقداری که می‌خواهیم تیپ بدهیم
const MIN_BALANCE_REQUIRED = "0.015"; // حداقل موجودی لازم در کیف پول اصلی برای اجرا

async function main() {
    if (!PRIVATE_KEY) {
        console.error("خطا: کلید خصوصی اصلی WALLET_PRIVATE_KEY در GitHub Secrets تنظیم نشده است!");
        process.exit(1);
    }

    console.log("در حال اتصال به شبکه موناد با کیف پول اصلی...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`کیف پول اصلی با موفقیت متصل شد. آدرس: ${wallet.address}`);

    try {
        // چک کردن موجودی کیف پول اصلی
        console.log("در حال بررسی موجودی کیف پول اصلی...");
        const balanceWei = await provider.getBalance(wallet.address);
        const minBalanceWei = ethers.parseEther(MIN_BALANCE_REQUIRED);

        if (balanceWei < minBalanceWei) {
            console.log(`❌ موجودی در کیف پول اصلی کافی نیست. نیاز به ${MIN_BALANCE_REQUIRED} MON دارید. عملیات تیپ لغو شد.`);
            return;
        }
        console.log("✅ موجودی کیف پول اصلی کافی است.");

        // اتصال به قرارداد تیپ
        const contract = new ethers.Contract(TIP_CONTRACT_ADDRESS, TIP_CONTRACT_ABI, wallet);
        console.log(`در حال آماده‌سازی تراکنش برای تیپ دادن ${AMOUNT_TO_TIP} موناد به آدرس ${TARGET_ADDRESS}...`);

        const amountInWei = ethers.parseEther(AMOUNT_TO_TIP);

        // اجرای تابع tip با فرستادن آدرس مقصد و مقدار تیپ
        const tx = await contract.tip(TARGET_ADDRESS, {
            value: amountInWei
        });

        console.log(`تراکنش تیپ ارسال شد. هش: ${tx.hash}`);
        console.log("در انتظار تایید تراکنش...");

        await tx.wait();
        
        console.log("✅ تیپ از طرف کیف پول اصلی با موفقیت ارسال شد!");

    } catch (error) {
        console.error("❌ مشکلی در حین فرآیند تیپ دادن پیش آمد:", error.message);
        process.exit(1);
    }
}

main();
