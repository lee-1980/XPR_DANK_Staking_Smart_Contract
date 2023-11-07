import { ExtendedAsset, Name, Table, EMPTY_NAME , Asset} from "..";
import {currentTimeSec} from "../chain";

@packer
export class LP {
    constructor (
        public token: string = '',
        public value: f32 = 0,
    ) {}
}

@table("balances")
export class Balance extends Table {
    constructor (
        public account: Name = EMPTY_NAME,
        public tokens: ExtendedAsset[] = [],
        public rewards: ExtendedAsset[] = [],
        public LastLP: LP[] = [],
        public LastUpdated: u32 = currentTimeSec()
    ) {
        super();
    }

    @primary
    get primary(): u64 {
        return this.account.N;
    }

}
