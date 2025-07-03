// src/deployer-loop.js

const { ethers } = require("ethers");

// --- اطلاعات شبکه و کیف پول ---
const RPC_URL = "https://testnet-rpc.monad.xyz";
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const MIN_BALANCE_REQUIRED = "0.05"; // حداقل موجودی لازم برای اجرای دیپلوی

// --- اطلاعات کامپایل شده قرارداد SimpleStorage ---
const SIMPLE_STORAGE_ABI = [
    {
      "inputs": [],
      "name": "get",
      "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "myNumber",
      "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "uint256", "name": "_newNumber", "type": "uint256" } ],
      "name": "set",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
];
const SIMPLE_STORAGE_BYTECODE = "0x608060405234801561001057600080fd5b5060c28061001f6000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c80632d4e7235146037578063a5d24950146055575b600080fd5b605360048036036020811015604b57600080fd5b81019080803590602001909291905050506079565b005b605b6083565b6040518082815260200191505060405180910390f35b8060008190555050565b6000805490509056fea2646970667358221220a2e92c2df6d05ac4f85e49058b8f2d592bd733152668541c48c3b70868a25c1564736f6c63430008140033";


// --- اطلاعات کامپایل شده قرارداد MyNFT ---
const MY_NFT_ABI = [
    {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
    {"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"owner","type":"address"}],"name":"ERC721IncorrectOwner","type":"error"},
    {"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ERC721InsufficientApproval","type":"error"},
    {"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC721InvalidApprover","type":"error"},
    {"inputs":[{"internalType":"address","name":"operator","type":"address"}],"name":"ERC721InvalidOperator","type":"error"},
    {"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"ERC721InvalidOwner","type":"error"},
    {"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC721InvalidReceiver","type":"error"},
    {"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC721InvalidSender","type":"error"},
    {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ERC721NonexistentToken","type":"error"},
    {"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},
    {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},
    {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"safeMint","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}
];
const MY_NFT_BYTECODE = "0x608060405234801561001057600080fd5b5060405161091e38038061091e83398181016040528101906100329190610086565b8060008190555050600180546001600160a01b0319166001600160a01b03929092169190911790556100c6565b60006020828403121561009857600080fd5b813567ffffffffffffffff8111156100b057600080fd5b60c0820186905260005b60208201850190526040820184019052606082018301905280820182905290565b6100e481610660565b82525050565b60006020820190506100ff60008301846100db565b92915050565b600060806040838503121561011e57600080fd5b60a18482018860048201526024820152604481018790526064909201915261014e91610660565b60405160ffff929190911681526020018083815260200182810382528381815260200192508151602001915050600060405180830381600087803b1580156101ad57600080fd5b505af11580156101c1573d6000803e3d6000fd5b50505050604051805190920190a15050565b600080fd5b600080600060a086880312156101f357600080fd5b6001848601890194526004840188905260248401879052604481019390526064810192905280820190925261022f91610660565b60405160ffff929190911681526020018083815260200182810382528381815260200192508151602001915050600060405180830381600087803b15801561028757600080fd5b505af115801561029b573d6000803e3d6000fd5b505050506040518051909190a150565b60006001815481106102bc57fe5b906000526020600020906101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b600061031261031d565b6001600160a01b03821661032a576000915054906101000a900460ff1681565b50610309565b815161008081602001908083835b602083106103555785860151835290509192505050610309565b505050565b7f4d7920417765736f6d65204e4654000000000000000000000000000000000000600082825401925050819055507f4d414e4654000000000000000000000000000000000000000000000000000000600182825401925050819055505050565b600060015481801561041b5750801561041857fe5b81151561041357fe5b60009050610423565b60008054600181526020810182526040808220805473ffffffffffffffffffffffffffffffffffffffff191673ffffffffffffffffffffffffffffffffffffffff1990921617909155519050565b60008281526020810181526020019050808201915050610304565b6000604082019050818103602083015261049e565b6104a7610660565b90506104b28282610477565b915081905092915050565b600080604083850312156104d457600080fd5b60008482018990526004840188905260248401879052604481018690526064810185905261050a91610660565b60405160ffff929190911681526020018083815260200182810382528381815260200192508151602001915050600060405180830381600087803b15801561056257600080fd5b505af1158015610576573d6000803e3d6000fd5b50505050604051805190920190a15050565b60003073ffffffffffffffffffffffffffffffffffffffff168282015260208201828201526040810190506105d1565b600060408201905081810360208301526105e9565b6105f2610660565b90506105fd82826105b2565b915081905092915050565b60006020828403121561061f57600080fd5b5035905061062d565b6000816001811061064257fe5b509150509150565b60008135905061065781610906565b92915050565b60006020828403121561067257600080fd5b50602083013567ffffffffffffffff81111561068e57600080fd5b604084013567ffffffffffffffff8111156106ac57600080fd5b606085013567ffffffffffffffff8111156106c957600080fd5b608084013567ffffffffffffffff168111156106e557600080fd5b60a085013567ffffffffffffffff1681111561070257600080fd5b848201869052600485018a90526024840189905260448101889052606485018790526084840186905261074191610660565b60405160ffff929190911681526020018083815260200182810382528381815260200192508151602001915050600060405180830381600087803b15801561079957600080fd5b505af11580156107ad573d6000803e3d6000fd5b50505050604051805190920190a15050565b600081519050919050565b600082825260208201905092915050565b60005b838110156108005780820151818401526020016107e8565b8381111561080f57600080fd5b505092915050565b60006040828403121561082c57600080fd5b610835826107ad565b9050602084013567ffffffffffffffff81111561085657600080fd5b61085f846107ad565b905092915050565b600067ffffffffffffffff8211156108995760008083815260200182815260200192505050600060008281548152602001908152602001905050610887565b828201905092915050565b60006108b48261085f565b9050919050565b60008183106108db5780810151818401526020016108c3565b50919050565b600080825482018154818115116108fc57fe5b6000918252602090820191905460019091019055565b60006020828403121561092e57600080fd5b610937826107ad565b9050602084013567ffffffffffffffff81111561095857600080fd5b610961846107ad565b90509291505056fea264697066735822122045e7f23c91c34a1a5b8f67e5bb4306385d26305608d0e519e9cae00a294d1b8264736f6c63430008140033";


async function deployContract(provider, wallet, abi, bytecode, contractName) {
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
        const minBalance = ethers.parseUnits(MIN_BALANCE_REQUIRED, "ether");

        console.log(`موجودی فعلی: ${ethers.formatEther(balance)} MON`);
        console.log(`حداقل موجودی مورد نیاز: ${MIN_BALANCE_REQUIRED} MON`);

        if (balance < minBalance) {
            console.log(`❌ موجودی کافی نیست (کمتر از ${MIN_BALANCE_REQUIRED} MON). عملیات دیپلوی لغو شد.`);
            process.exit(0);
        }
        console.log("✅ موجودی کافی است. شروع فرآیند دیپلوی...");

        // ۱. دیپلوی قرارداد SimpleStorage
        const simpleStorageAddress = await deployContract(provider, wallet, SIMPLE_STORAGE_ABI, SIMPLE_STORAGE_BYTECODE, "SimpleStorage");
        if (!simpleStorageAddress) {
            throw new Error("دیپلوی SimpleStorage ناموفق بود.");
        }

        // تاخیر کوتاه بین دو دیپلوی
        console.log("\n... انتظار 5 ثانیه قبل از دیپلوی بعدی ...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // ۲. دیپلوی قرارداد MyNFT
        const myNftAddress = await deployContract(provider, wallet, MY_NFT_ABI, MY_NFT_BYTECODE, "MyNFT");
        if (!myNftAddress) {
            throw new Error("دیپلوی MyNFT ناموفق بود.");
        }

        console.log("\n🎉🎉🎉 هر دو قرارداد با موفقیت دیپلوی شدند! 🎉🎉🎉");

    } catch (error) {
        console.error("\nخطایی کلی در اجرای اسکریپت دیپلوی رخ داد:", error.message);
        process.exit(1);
    }
}

main();
