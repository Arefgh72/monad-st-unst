// src/interact.js

const { ethers } = require("ethers");

// --- اطلاعات قراردادها و شبکه ---
// این اطلاعات از فایل deployment_output.json شما برداشته شده است.
const RPC_URL = "https://testnet-rpc.monad.xyz";
const INTERACT_PROXY_ADDRESS = "0x2b645EE6053ba983a5eAd21AD339caA9B0d072d4";
const INTERACT_PROXY_ABI = [
    "function interactWithFee() public payable",
    "function withdrawEther() public"
];

// --- تنظیمات اسکریپت ---
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY; // از سکرت اصلی خوانده می‌شود
const INTERACT_FEE = "0.001"; // کارمزد لازم برای تابع interactWithFee
const MIN_BALANCE_REQUIRED = "0.01"; // حداقل موجودی لازم برای اجرا

/**
 * تابع کمکی برای ارسال تراکنش و انتظار برای رسید آن
 * @param {ethers.Wallet} wallet - نمونه کیف پول امضاکننده
 * @param {object} tx - آبجکت تراکنش ساخته شده
 * @param {string} actionName - نام عملیات برای نمایش در لاگ
 * @returns {Promise<ethers.TransactionReceipt|null>} - رسید تراکنش در صورت موفقیت، در غیر این صورت null
 */
async function sendTransaction(wallet, tx, actionName) {
    console.log(`    > در حال امضا و ارسال تراکنش برای: ${actionName}...`);
    try {
        // افزودن پارامترهای گاز به صورت خودکار
        const txWithGas = await wallet.populateTransaction(tx);
        
        const signedTx = await wallet.signTransaction(txWithGas);
        const txResponse = await provider.send("eth_sendRawTransaction", [signedTx]);
        console.log(`    > تراکنش ارسال شد. هش: ${txResponse}`);
        console.log("    > در انتظار تایید تراکنش...");
        const receipt = await provider.waitForTransaction(txResponse, 1, 180); // انتظار تا 1 بلاک و مهلت 180 ثانیه
        
        if (receipt.status === 1) {
            console.log(`    > ✅ تراکنش '${actionName}' با موفقیت تایید شد.`);
            return receipt;
        } else {
            console.error(`    > ❌ تراکنش '${actionName}' ناموفق بود (reverted).`);
            return null;
        }
    } catch (error) {
        console.error(`    > ❌ خطا در ارسال یا تایید تراکنش '${actionName}':`, error.message);
        return null;
    }
}


async function main() {
    console.log("--- شروع اسکریپت تعامل با dApp شما ---");

    // ۱. تنظیمات اولیه و اتصال
    if (!PRIVATE_KEY) {
        console.error("خطا: کلید خصوصی WALLET_PRIVATE_KEY در GitHub Secrets تنظیم نشده است!");
        process.exit(1);
    }
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const proxyContract = new ethers.Contract(INTERACT_PROXY_ADDRESS, INTERACT_PROXY_ABI, wallet);

    console.log(`کیف پول اصلی متصل شد: ${wallet.address}`);

    try {
        // ۲. چک کردن موجودی و برداشت خودکار کارمزد
        let balance = await provider.getBalance(wallet.address);
        const minBalance = ethers.parseUnits(MIN_BALANCE_REQUIRED, "ether");
        const feeAmount = ethers.parseUnits(INTERACT_FEE, "ether");

        console.log(`موجودی فعلی: ${ethers.formatEther(balance)} MON`);
        console.log(`حداقل موجودی مورد نیاز: ${MIN_BALANCE_REQUIRED} MON`);

        if (balance < minBalance) {
            console.log("⚠️ موجودی کمتر از حد مجاز است. تلاش برای برداشت کارمزدهای جمع‌شده...");

            const withdrawTx = await proxyContract.withdrawEther.populateTransaction();
            const withdrawReceipt = await sendTransaction(wallet, withdrawTx, "برداشت کارمزد");

            if (withdrawReceipt) {
                console.log("برداشت موفق بود. انتظار 5 ثانیه و بررسی مجدد موجودی...");
                await new Promise(resolve => setTimeout(resolve, 5000)); // تاخیر برای آپدیت شدن موجودی در نود RPC
                balance = await provider.getBalance(wallet.address);
                console.log(`موجودی جدید: ${ethers.formatEther(balance)} MON`);
            } else {
                console.error("عملیات برداشت ناموفق بود.");
            }

            // شرط جدید شما: چک کردن دوباره موجودی پس از تلاش برای برداشت
            if (balance < minBalance) {
                console.error("❌ پس از تلاش برای برداشت، موجودی هنوز کافی نیست. عملیات برای این نوبت لغو می‌شود.");
                process.exit(0); // خروج موفق، چون این یک حالت قابل پیش‌بینی است و خطا نیست
            }
        }

        console.log("✅ موجودی کافی است. شروع تعامل اصلی...");

        // ۳. اجرای تعامل اصلی (interactWithFee)
        const interactTx = await proxyContract.interactWithFee.populateTransaction({
            value: feeAmount
        });
        
        const interactReceipt = await sendTransaction(wallet, interactTx, "تعامل اصلی (interactWithFee)");

        if (interactReceipt) {
            console.log("🎉🎉🎉 عملیات تعامل با dApp با موفقیت کامل انجام شد! 🎉🎉🎉");
        } else {
            console.error("عملیات تعامل اصلی ناموفق بود.");
            process.exit(1); // خروج با خطا چون تعامل اصلی باید موفق می‌شد
        }

    } catch (error) {
        console.error("خطایی کلی در اجرای اسکریپت رخ داد:", error.message);
        process.exit(1);
    }
}

main();
