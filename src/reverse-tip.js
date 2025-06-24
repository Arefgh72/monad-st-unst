// src/reverse-tip.js

const { ethers } = require("ethers");

// --- اطلاعات قرارداد و شبکه (مشابه فایل قبلی) ---
const RPC_URL = "https://testnet-rpc.monad.xyz";
const TIP_CONTRACT_ADDRESS = "0xd3E51bfEE95E31760B671AfEF9763fB2CF4A375a";
const TIP_CONTRACT_ABI = [
    "function tip(address recipient) public payable"
];

// --- تنظیمات اسکریپت ---
// !!! توجه: این اسکریپت از کلید خصوصی کیف پول فرعی شما استفاده می‌کند !!!
const SECONDARY_PRIVATE_KEY = process.env.SECONDARY_WALLET_PRIVATE_KEY;

const MAIN_WALLET_ADDRESS = "0xFDA1d6115A49adf731570800D35C901ad4e0057B"; // آدرس کیف پول اصلی به عنوان مقصد
const AMOUNT_TO_TIP = "0.01"; // مقداری که می‌خواهیم تیپ بدهیم
const MIN_BALANCE_REQUIRED = "0.015"; // حداقل موجودی لازم در کیف پول فرعی برای اجرا

async function main() {
    if (!SECONDARY_PRIVATE_KEY) {
        console.error("خطا: کلید خصوصی فرعی SECONDARY_WALLET_PRIVATE_KEY در GitHub Secrets تنظیم نشده است!");
        process.exit(1);
    }

    console.log("در حال اتصال به شبکه موناد با کیف پول فرعی...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(SECONDARY_PRIVATE_KEY, provider);
    console.log(`کیف پول فرعی با موفقیت متصل شد. آدرس: ${wallet.address}`);

    try {
        // چک کردن موجودی کیف پول فرعی
        console.log("در حال بررسی موجودی کیف پول فرعی...");
        const balanceWei = await provider.getBalance(wallet.address);
        const minBalanceWei = ethers.parseEther(MIN_BALANCE_REQUIRED);

        if (balanceWei < minBalanceWei) {
            console.log(`❌ موجودی در کیف پول فرعی کافی نیست. نیاز به ${MIN_BALANCE_REQUIRED} MON دارید. عملیات تیپ معکوس لغو شد.`);
            return;
        }
        console.log("✅ موجودی کیف پول فرعی کافی است.");

        // اتصال به قرارداد تیپ
        const contract = new ethers.Contract(TIP_CONTRACT_ADDRESS, TIP_CONTRACT_ABI, wallet);
        console.log(`در حال آماده‌سازی تراکنش برای تیپ دادن ${AMOUNT_TO_TIP} موناد به آدرس اصلی (${MAIN_WALLET_ADDRESS})...`);

        const amountInWei = ethers.parseEther(AMOUNT_TO_TIP);

        // اجرای تابع tip با فرستادن آدرس مقصد (کیف پول اصلی) و مقدار تیپ
        const tx = await contract.tip(MAIN_WALLET_ADDRESS, {
            value: amountInWei
        });

        console.log(`تراکنش تیپ معکوس ارسال شد. هش: ${tx.hash}`);
        console.log("در انتظار تایید تراکنش...");

        await tx.wait();
        
        console.log("✅ تیپ از طرف کیف پول فرعی با موفقیت ارسال شد!");

    } catch (error) {
        console.error("❌ مشکلی در حین فرآیند تیپ معکوس پیش آمد:", error.message);
        process.exit(1);
    }
}

main();
