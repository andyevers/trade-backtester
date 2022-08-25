import Repository, { Entity } from './Repository'

export interface Account extends Entity {
	cash: number
	marginDebt: number
	startingCash: number
}

export interface AccountCreateParams extends Omit<Partial<Account>, 'id'> {
	startingCash: number
}

export default class AccountRepository extends Repository<Account> {
	public override create(params: AccountCreateParams): Account {
		const { startingCash, cash = startingCash, marginDebt = 0 } = params
		return super.create({ cash, marginDebt, startingCash })
	}
}
