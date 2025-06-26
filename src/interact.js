// src/interact.js - نسخه نهایی و مقاوم در برابر Timeout

const { ethers } = require("ethers");

// --- اطلاعات قراردادها و شبکه ---
const RPC_URL = "https://testnet-rpc.monad.xyz";
const INTERACT_PROXY_ADDRESS = "0x2b645EE6053ba983a5eAd21AD339caA9B0d072d4";
const INTERACT_PROXY_ABI = [
    "function interactWithFee() public payable",
    "function withdrawEther() public"
];

// --- تنظیمات اسکریپت ---
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const INTERACT_FEE = "0.001";
const MIN_BALANCE_REQUIRED = "0.01";

/**
 * تابع کمکی برای ارسال تراکنش و انتظار برای رسید آن
 * @param {ethers.JsonRpcProvider} provider
 * @param {ethers.Wallet} wallet
 * @param {object} tx
 * @param {string} actionName
 * @returns {Promise<ethers.TransactionReceipt|null>}
 */
async function sendTransaction(provider, wallet, tx, actionName) {
    console.log(`    > در حال امضا و ارسال تراکنش برای: ${actionName}...`);
    try {
        const txWithGas = await wallet.populateTransaction(tx);
        const signedTx = await wallet.signTransaction(txWithGas);
        const txResponseHash = await provider.send("eth_sendRawTransaction", [signedTx]);
        
        console.log(`    > تراکنش ارسال شد. هش: ${txResponseHash}`);
        console.log("    > در انتظار تایید تراکنش (تا ۱۰ دقیقه)...");
        
        // Timeout به ۶۰۰ ثانیه (۱۰ دقیقه) افزایش یافت
        const receipt = await provider.waitForTransaction(txResponseHash, 1, 600000); 
        
        // <<<< (تغییر اصلی) مدیریت بهتر خروجی تابع انتظار >>>>
        if (receipt && receipt.status === 1) {
            console.log(`    > ✅ تراکنش '${actionName}' با موفقیت تایید شد.`);
            return receipt;
        } else if (receipt && receipt.status === 0) {
            console.error(`    > ❌ تراکنش '${actionName}' ناموفق بود (reverted).`);
            return null;
        } else {
            // اگر بعد از ۱۰ دقیقه رسید دریافت نشود، به جای خطا، یک هشدار می‌دهیم
            console.warn(`    > ⚠️ هشدار: رسید تراکنش '${actionName}' در مهلت زمانی مشخص دریافت نشد (timeout).`);
            console.warn(`    > این به معنی شکست تراکنش نیست. لطفاً هش را در اکسپلورر چک کنید: ${txResponseHash}`);
            return "timeout_warning"; // یک مقدار خاص برای مدیریت در ادامه برمی‌گردانیم
        }
    } catch (error) {
        console.error(`    > ❌ خطا در ارسال یا تایید تراکنش '${actionName}':`, error.message);
        return null;
    }
}


async function main() {
    console.log("--- شروع اسکریپت تعامل با dApp شما ---");

    if (!PRIVATE_KEY) {
        console.error("خطا: کلید خصوصی WALLET_PRIVATE_KEY در GitHub Secrets تنظیم نشده است!");
        process.exit(1);
    }
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const proxyContract = new ethers.Contract(INTERACT_PROXY_ADDRESS, INTERACT_PROXY_ABI, wallet);

    console.log(`کیف پول اصلی متصل شد: ${wallet.address}`);

    try {
        let balance = await provider.getBalance(wallet.address);
        const minBalance = ethers.parseUnits(MIN_BALANCE_REQUIRED, "ether");
        const feeAmount = ethers.parseUnits(INTERACT_FEE, "ether");

        console.log(`موجودی فعلی: ${ethers.formatEther(balance)} MON`);
        console.log(`حداقل موجودی مورد نیاز: ${MIN_BALANCE_REQUIRED} MON`);

        if (balance < minBalance) {
            console.log("⚠️ موجودی کمتر از حد مجاز است. تلاش برای برداشت کارمزدهای جمع‌شده...");

            const withdrawTx = await proxyContract.withdrawEther.populateTransaction();
            const withdrawReceipt = await sendTransaction(provider, wallet, withdrawTx, "برداشت کارمزد");

            if (withdrawReceipt && withdrawReceipt !== "timeout_warning") {
                console.log("برداشت موفق بود. انتظار 5 ثانیه و بررسی مجدد موجودی...");
                await new Promise(resolve => setTimeout(resolve, 5000));
                balance = await provider.getBalance(wallet.address);
                console.log(`موجودی جدید: ${ethers.formatEther(balance)} MON`);
            } else {
                console.error("عملیات برداشت ناموفق بود یا با timeout مواجه شد.");
            }

            if (balance < minBalance) {
                console.error("❌ پس از تلاش برای برداشت، موجودی هنوز کافی نیست. عملیات برای این نوبت لغو می‌شود.");
                process.exit(0);
            }
        }

        console.log("✅ موجودی کافی است. شروع تعامل اصلی...");

        const interactTx = await proxyContract.interactWithFee.populateTransaction({
            value: feeAmount
        });
        
        const interactReceipt = await sendTransaction(provider, wallet, interactTx, "تعامل اصلی (interactWithFee)");

        // <<<< (تغییر اصلی) مدیریت خروجی نهایی >>>>
        if (interactReceipt && interactReceipt !== "timeout_warning") {
            console.log("🎉🎉🎉 عملیات تعامل با dApp با موفقیت کامل انجام شد! 🎉🎉🎉");
        } else if (interactReceipt === "timeout_warning") {
            console.log("✅ عملیات با موفقیت به شبکه ارسال شد اما منتظر تایید نماندیم. اجرای ورک‌فلو موفق در نظر گرفته می‌شود.");
        } else {
            console.error("عملیات تعامل اصلی ناموفق بود.");
            process.exit(1);
        }

    } catch (error) {
        console.error("خطایی کلی در اجرای اسکریپت رخ داد:", error.message);
        process.exit(1);
    }
}

main();
