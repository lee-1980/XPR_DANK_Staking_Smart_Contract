import { ExtendedAsset, Name, Table, EMPTY_NAME } from "..";

@table("balances")
export class Balance extends Table {
    constructor (
        public account: Name = EMPTY_NAME,
        public tokens: ExtendedAsset[] = [],
    ) {
        super();
    }

    @primary
    get primary(): u64 {
        return this.account.N;
    }
}
