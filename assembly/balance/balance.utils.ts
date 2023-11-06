import { check, ExtendedAsset, Name } from ".."
import { Balance } from "./balance.tables";

/**
 * Find the index of an extended asset in an array of extended assets
 * @param {ExtendedAsset[]} tokens - The list of tokens to search through.
 * @param {ExtendedAsset} token - ExtendedAsset
 * @returns The index of the token in the array of tokens.
 */
export function findIndexOfExtendedAsset (tokens: ExtendedAsset[], token: ExtendedAsset): i32 {
    let tokenIndex = -1
    for (let j = 0; j < tokens.length; j++) {
        if (tokens[j].getExtendedSymbol() == token.getExtendedSymbol()) {
            tokenIndex = j
            break;
        }
    }
    return tokenIndex
}



/**
 * It finds the index of the token in the array of tokens,
 * and then it substracts the balance of the user.
 * @param {ExtendedAsset[]} tokens - The list of tokens that the user has.
 * @param {ExtendedAsset} sub - The asset to be subtracted from the user's balance.
 */
export function substractToken (tokens: ExtendedAsset[], sub: ExtendedAsset): void {
    // Validation
    check(sub.quantity.isValid(), "valid quantity");
    check(sub.quantity.amount > 0, "sub quantity must be positive");



    // Find index of token
    const tokenIndex = findIndexOfExtendedAsset(tokens, sub)
    check(tokenIndex != -1, "no balance found for user to reduce balance")

    // Substract Balance

    const currentBalance = tokens[tokenIndex]
    check(currentBalance >= sub, "user balance too low")
    tokens[tokenIndex] = ExtendedAsset.sub(tokens[tokenIndex], sub)

    // Delete if zero
    if (tokens[tokenIndex].quantity.amount == 0) {
        tokens.splice(tokenIndex, 1)
    }
}

/**
 * It subtracts the tokens from the account.
 * @param {Balance} balance - Account
 * @param {ExtendedAsset[]} tokensToSubtract - An array of ExtendedAsset objects.
 */
export function substractTokens(balance: Balance, tokensToSubtract: ExtendedAsset[]):  void {
    for (let i = 0; i < tokensToSubtract.length; i++) {
        substractToken(balance.tokens, tokensToSubtract[i])
    }
}

/**
 * It subtracts the Rewards from the account.
 * @param {Balance} balance - Account
 * @param {ExtendedAsset[]} tokensToSubtract - An array of ExtendedAsset objects.
 */
export function substractRewards(balance: Balance, RewardsToSubtract: ExtendedAsset[]):  void {
    for (let i = 0; i < RewardsToSubtract.length; i++) {
        substractToken(balance.rewards, RewardsToSubtract[i])
    }
}


/**
 * If the token does not exist, add it. If the token exists, update the balance
 * @param {ExtendedAsset[]} tokens - The list of tokens that the user owns.
 * @param {ExtendedAsset} add - ExtendedAsset
 */
export function addToken(tokens: ExtendedAsset[], add: ExtendedAsset): void {
    // Validation
    check(add.quantity.isValid(), "valid quantity");
    check(add.quantity.amount > 0, "add quantity must be positive");

    // Find index of token
    const tokenIndex = findIndexOfExtendedAsset(tokens, add)

    // If token does not exist, add it
    if (tokenIndex == -1) {
        tokens.push(add)
    }
    // If token exists, update balance
    else {
        tokens[tokenIndex] = ExtendedAsset.add(tokens[tokenIndex], add)
    }
}

/**
 * It adds the tokens to the balance's tokens array.
 * @param {Balance} account - The balance to add the tokens to.
 * @param {ExtendedAsset[]} tokensToAdd - An array of ExtendedAsset objects.
 */
export function addTokens(balance: Balance, tokensToAdd: ExtendedAsset[]): void {
    for (let i = 0; i < tokensToAdd.length; i++) {
        addToken(balance.tokens, tokensToAdd[i])
    }
}

export function skipDepositFrom(from: Name, currentContract: Name): boolean {
    if (from == currentContract) {
        return true
    }

    // Skip if deposit from system accounts
    if (
        from == Name.fromString("eosio.ram") ||
        from == Name.fromString("eosio")
    ) {
        return true
    }

    return false
}


