import { expect } from "chai";
import { beforeEach} from "mocha"
import { Blockchain, protonAssert, expectToThrow, createDummyNfts, mintTokens, Account, nameToBigInt, symbolCodeToBigInt } from "@proton/vert"
import { Asset, Name, TimePointSec } from '@greymass/eosio'

async function wait (ms: number) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
}

const main = async () => {
    const blockchain = new Blockchain()
    let now = new Date();

    let point = TimePointSec.fromMilliseconds(now.getTime());

    blockchain.setTime(point)

    const balanceContract = blockchain.createContract('balance', 'assembly/balance/target/assembly/balance/balance.contract')
    const xtokensContract = blockchain.createContract('xtokens', 'assembly/token/target/token.contract')
    const eosioTokenContract = blockchain.createContract('eosio.token', 'assembly/token/target/token.contract')

    const [collector, trader, artist] = blockchain.createAccounts('collector', 'trader', 'artist')


    await wait(2)

    blockchain.resetTables()

    await mintTokens(xtokensContract, 'XUSDC', 6, 1000000, 100000, [trader, collector, artist])
    await mintTokens(eosioTokenContract, 'XPR', 4, 1000000, 100000, [collector])


    await wait(1)

    const getBalanceRows = () => balanceContract.tables.balances().getTableRows()
    const getGlobalRow = () => balanceContract.tables.allowglobals().getTableRows()
    const getAccount = (contract: Account, accountName: string, symcode: string) => {
        const accountBigInt = nameToBigInt(Name.from(accountName));
        const symcodeBigInt = symbolCodeToBigInt(Asset.SymbolCode.from(symcode));
        return contract.tables.accounts(accountBigInt).getTableRow(symcodeBigInt)
    }


    const getXUSDCBalance = (accountName: string) => getAccount(xtokensContract, accountName, 'XUSDC')
    const getXPRBalance = (accountName: string) => getAccount(eosioTokenContract, accountName, 'XPR')

    console.log(await getXUSDCBalance('trader'))

    console.log('add balance------------------------------------')
    await balanceContract.actions.setglobals([false, true, true, true, true,
        { "sym": "6,XUSDC", "contract": "xtokens" },
        { "sym": "4,XPR", "contract": "eosio.token" }, 5]).send()

    await balanceContract.actions.setactor(["xtokens", true, false]).send()
    await balanceContract.actions.setactor(["eosio.token", true, false]).send()
    await balanceContract.actions.settoken([{ "sym": "6,XUSDC", "contract": "xtokens" },  true, false]).send()
    await balanceContract.actions.settoken([{ "sym": "4,XPR", "contract": "eosio.token" },  true, false]).send()

    await eosioTokenContract.actions.transfer(['collector', 'balance', '100000.0000 XPR', 'deposit']).send('collector@active')

    console.log('-------Before first Sending in Script')
    await xtokensContract.actions.transfer(['trader', 'balance', '200.000000 XUSDC', 'deposit']).send('trader@active')
    await xtokensContract.actions.transfer(['artist', 'balance', '200.000000 XUSDC', 'deposit']).send('artist@active')

    console.log('-------------------------------Before first Sending XRP in Script')


    console.log(await getBalanceRows()[0])
    console.log(await getBalanceRows()[1])
    console.log(await getBalanceRows()[2])

    // await wait(9000)
    //
    // now = new Date();
    // point = TimePointSec.fromMilliseconds(now.getTime());
    // blockchain.setTime(point)
    //
    // await xtokensContract.actions.transfer(['trader', 'balance', '20.000000 XUSDC', 'deposit']).send('trader@active')
    // // await xtokensContract.actions.transfer(['artist', 'balance', '20.000000 XUSDC', 'deposit']).send('artist@active')
    // await balanceContract.actions.withdraw(['artist', [{ "quantity": "20.000000 XUSDC", "contract": "xtokens" }]]).send('artist@active')
    // console.log(await getBalanceRows()[0])
    // console.log(await getBalanceRows()[1])
    // console.log(await getBalanceRows()[2])

    await wait(9000)

    now = new Date();
    point = TimePointSec.fromMilliseconds(now.getTime());
    blockchain.setTime(point)
    await balanceContract.actions.transreward().send('balance@active')

    console.log(await getBalanceRows()[0])
    console.log(await getBalanceRows()[1])
    console.log(await getBalanceRows()[2])
    console.log(await getGlobalRow()[0])
    console.log(await getXPRBalance("trader"))
    console.log(await getXPRBalance("artist"))

}

main()
