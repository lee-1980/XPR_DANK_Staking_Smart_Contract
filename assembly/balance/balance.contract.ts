import {ExtendedAsset, unpackActionData, Name, check, requireAuth, SAME_PAYER, TableStore, Asset, currentTimeSec} from '..'
import {Transfer, sendTransferTokens, sendTransferToken} from '../token/token.inline';
import {AllowContract} from '../allow';
import {Balance} from './balance.tables';
import {addTokens, findIndexOfExtendedAsset, skipDepositFrom, substractTokens, substractRewards} from './balance.utils';


@contract
export class BalanceContract extends AllowContract {
    balancesTable: TableStore<Balance> = new TableStore<Balance>(this.receiver)

    /**
     * Incoming notification of "transfer" action from any contract
     * The action data is a token transfer
     * @returns Nothing.
     */
    @action("transfer", notify)
    transfer(): void {
        // Pre-conditions
        this.checkContractIsNotPaused()


        // Unpack token transfer
        let t = unpackActionData<Transfer>()

        // Skip
        if (skipDepositFrom(t.from, this.contract)) {
            return;
        }

        // Validate transfer
        check(t.to == this.contract, "Invalid Deposit");

        // Balance
        const tokens = [new ExtendedAsset(t.quantity, this.parentContract)]

        // Check allowed
        this.checkTokensAreEnabled()
        // Allow deposits
        check(this.isActorAllowed(this.parentContract), `Tokens from contract ${this.parentContract} are not enabled for deposits`)
        check(this.isTokenAllowed(tokens[0].getExtendedSymbol()), `Token ${tokens[0]} is not enabled for deposits`)

        // Add balance
        this.addBalance(t.from, tokens, this.contract)
    }

    /**
     * Distribute all accounts' reward tokens and set reward to zero
     */
    @action("transreward")
    transreward(): void {
        // Authorization
        requireAuth(this.contract)

        // Pre-conditions
        this.checkContractIsNotPaused()

        // Get All Accounts

        if (!this.balancesTable.isEmpty()) {
            let account = this.balancesTable.first()
            if(!account) return
            while(this.balancesTable.existsValue(account)){
                try{
                    if(!account) break;
                    this.updateReward(account)
                    this.distribute(account)
                    account = this.balancesTable.next(account)
                    if(!account) break;
                }
                catch (e) {
                    console.log(e.message)
                    continue;
                }
            }
        }
    }

    /**
     * Withdraw token from an contract and transfer them to an actor by only contract owner
     * @param {Name} actor - Name
     * @param {ExtendedAsset[]} tokens - An array of `ExtendedAsset` objects.
     */
    @action("withdraw")
    withdraw(
        actor: Name,
        tokens: ExtendedAsset[],
    ): void {
        // Authorization
        requireAuth(actor)

        // Pre-conditions
        this.checkContractIsNotPaused()
        // Substract Tokens from actor balance
        this.substractBalance(actor, tokens)

        // Inline transfer Tokens from contract to actor
        this.withdrawAdmin(actor, tokens, "withdraw")
    }

    // @action("viewareward")
    // viewareward(
    //     actor: Name
    // ) : f64{
    //     // Authorization
    //     requireAuth(actor)
    //
    //     // Get actor
    //     let account = this.balancesTable.get(actor.N)
    //     if (!account) {
    //         account = new Balance(actor)
    //     }
    //
    //     return this.calculateAvailableRewards(account).quantity.amount as f64
    // }

    /**
     * Withdraw all tokens from the contract and transfer them to the actor.
     * Note:
     *  - Does not reduce balance
     *  - Assumes caller has already reduced balance using modifyBalance
     * @param {Name} actor - Name
     * @param {ExtendedAsset[]} tokens - The list of tokens to transfer.
     * @param {string} memo - string
     */
    withdrawAdmin(
        actor: Name,
        tokens: ExtendedAsset[],
        memo: string
    ): void {
        // Authorization
        // Not a public action, so only contract can call

        // Inline transfer Tokens from contract to actor
        sendTransferTokens(this.contract, actor, tokens, "Reward")
    }

    /**
     * It substracts tokens from an actor.
     * @param {Name} actor - The actor for which to modify balances
     * @param {ExtendedAsset[]} tokens - The list of tokens that are being added or removed from the actor.
     * @param {Name} ramPayer - Account that pays for RAM
     */
    substractBalance(actor: Name, tokens: ExtendedAsset[]): void {
        // Get account
        const account = this.balancesTable.requireGet(actor.N, `Account ${actor} not found`)

        this.updateReward(account)
        // Substract Tokens
        substractTokens(account, tokens)
        // Delete table if no tokens
        // Update table if token found
        if (account.tokens.length == 0) {
            this.balancesTable.remove(account);
        } else {
            this.balancesTable.update(account, SAME_PAYER)
        }
    }

    /**
     * It adds tokens from an actor.
     * @param {Name} actor - The actor for which to modify balances
     * @param {ExtendedAsset[]} tokens - The list of tokens that are being added or removed from the actor.

     * @param {Name} ramPayer - Account that pays for RAM
     */
    addBalance(actor: Name, tokens: ExtendedAsset[], ramPayer: Name = actor): void {
        // Get actor
        let account = this.balancesTable.get(actor.N)
        if (!account) {
            account = new Balance(actor)
        }
        this.updateReward(account)
        // Add Tokens

        addTokens(account, tokens)

        // Upsert table
        this.balancesTable.set(account, ramPayer)
    }

    /**
     * Update Rewards before any update of token balance
     * @param {Balance} balance - Account
     */

    updateReward(account: Balance): void {

        let newRewardExtendedAsset = this.calculateAvailableRewards(account)
        //----- Update the Rewards
        const rewardIndex = findIndexOfExtendedAsset(account.rewards, newRewardExtendedAsset)

        if (rewardIndex == -1) {
            account.rewards.push(newRewardExtendedAsset)
        } else{

            account.rewards[rewardIndex] = ExtendedAsset.add(account.rewards[rewardIndex], newRewardExtendedAsset)
            //----- Update the last time
        }
        account.LastUpdated = currentTimeSec()
    }

    calculateAvailableRewards(account: Balance) : ExtendedAsset {

        //----- Get the depositToken
        const depositToken = this.allowGlobalsSingleton.get().depositToken
        const depositTokenContract = depositToken.contract
        const depositTokenSymbol = depositToken.sym

        //----- Get the last Updated Time
        let timeDiffInSec = sub(currentTimeSec(), account.LastUpdated) as f32
        // let timeDiffInSec = f32(90000)
        const rewardPercentageDurationPerToken = mul(div(timeDiffInSec, <f32>86400), this.allowGlobalsSingleton.get().percentage)
        //----- Get the token deposited of the account
        let accountDepositTokenExtendedAsset = new ExtendedAsset(new Asset(0, depositTokenSymbol), depositTokenContract)
        // Find index of token
        const tokenIndex = findIndexOfExtendedAsset(account.tokens, accountDepositTokenExtendedAsset)

        if (tokenIndex != -1) {
            accountDepositTokenExtendedAsset = account.tokens[tokenIndex]
        }

        //----- Get the rewardToken
        const rewardToken = this.allowGlobalsSingleton.get().rewardToken
        const rewardTokenContract = rewardToken.contract
        const rewardTokenSymbol = rewardToken.sym
        const decimalDifference = accountDepositTokenExtendedAsset.quantity.symbol.precision() - rewardTokenSymbol.precision()


        const newAvailableRewards =mul( div(accountDepositTokenExtendedAsset.quantity.amount,
            Math.pow(10, decimalDifference) as i64) as f32,
            rewardPercentageDurationPerToken
        ) as i64

        //----- Calculate new reward of the deposited token
        return new ExtendedAsset(
            new Asset(
                newAvailableRewards,
                rewardTokenSymbol
            ),
            rewardTokenContract
        )
    }

    /**
     * Distribute Reward tokens to actor
     * @param {Balance} balance - Account
     */

    distribute(account: Balance): void {
        //----- Get the rewardToken
        const rewardToken = this.allowGlobalsSingleton.get().rewardToken
        const rewardTokenContract = rewardToken.contract
        const rewardTokenSymbol = rewardToken.sym

        const rewardZeroExtendedAsset = new ExtendedAsset(
            new Asset(
                0,
                rewardTokenSymbol
            ),
            rewardTokenContract
        )
        // Get the current reward ExtendedAsset
        const rewardIndex = findIndexOfExtendedAsset(account.rewards, rewardZeroExtendedAsset)

        if (rewardIndex != -1 && account.rewards[rewardIndex].quantity.amount > 0) {
            const rewardBalance : ExtendedAsset = account.rewards[rewardIndex]
            substractRewards(account, [account.rewards[rewardIndex]])
            this.balancesTable.update(account, this.contract)
            sendTransferToken(rewardBalance.contract, this.contract, account.account, rewardBalance.quantity, "Reward")
        }
    }
}
