import Repository, { Entity, RepositoryArgs } from './Repository'

export interface Account extends Entity {
	cash: number
	startingCash: number
	marginDebt: number
	startingMarginDebt: number
}

export interface AccountCreateParams extends Omit<Partial<Account>, 'id'> {
	startingCash: number
}

export default class AccountRepository extends Repository<Account> {
	constructor(args: RepositoryArgs) {
		const { eventBus } = args
		super({ eventBus, eventPrefix: 'accountRepository' })
	}
	public override create(params: AccountCreateParams): Account {
		const {
			startingCash,
			cash = startingCash,
			startingMarginDebt = 0,
			marginDebt = startingMarginDebt
		} = params
		return super.create({ cash, marginDebt, startingCash, startingMarginDebt })
	}
}
