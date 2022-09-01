import { Broker, Timeline } from './broker'
import { EntityManager } from './repository'
import { AccountService, PositionService, TriggerService } from './service'

interface BacktesterArgs {}

interface BacktesterDeps {
	EntityManagerClass: typeof EntityManager
	AccountServiceClass: typeof AccountService
	PositionServiceClass: typeof PositionService
	TriggerServiceClass: typeof TriggerService
	TimelineClass: typeof Timeline
	BrokerClass: typeof Broker
}

export default class Backtester {
	private readonly broker: Broker

	constructor(args: BacktesterArgs, _deps?: BacktesterDeps) {
		const {
			AccountServiceClass = AccountService,
			BrokerClass = Broker,
			EntityManagerClass = EntityManager,
			PositionServiceClass = PositionService,
			TimelineClass = Timeline,
			TriggerServiceClass = TriggerService
		} = _deps || {}

		const entityManager = new EntityManagerClass()
		const broker = new BrokerClass({ entityManager })
		// const broker = new BrokerClass({
		// 	// accountService,
		// 	entityManager,
		// 	// positionService,
		// 	timeline
		// 	// triggerService
		// })

		this.broker = broker
	}
}
