import {DmScreenPanelAppBase} from "./dmscreen-panelapp-base.js";

export class PlayerReference extends DmScreenPanelAppBase {
	_getPanelElement (board, state) {
		const ele = veT`<div class="ve-w-100 ve-h-100 dm-player-ref__root dm__panel-bg"></div>`;
		this._comp = new PlayerReferenceRoot(board, {isCompact: false});
		this._comp.setStateFrom(state);
		this._comp.render(ele);
		return ele;
	}

	getState () { return this._comp?.getSaveableState(); }
	onBoardEvent (evt) { this._comp?.onBoardEvent(evt); }
}

export class PlayerStrip extends DmScreenPanelAppBase {
	_getPanelElement (board, state) {
		const ele = veT`<div class="ve-w-100 ve-h-100 dm-player-strip__root dm__panel-bg"></div>`;
		this._comp = new PlayerReferenceRoot(board, {isCompact: true});
		this._comp.setStateFrom(state);
		this._comp.render(ele);
		return ele;
	}

	getState () { return this._comp?.getSaveableState(); }
	onBoardEvent (evt) { this._comp?.onBoardEvent(evt); }
}

class PlayerReferenceComponent extends BaseComponent {
	constructor (board) {
		super();
		this._board = board;
		this._addHookAll("state", () => this._board.doSaveStateDebounced());
	}
}

class PlayerReferenceRoot extends PlayerReferenceComponent {
	static _NEXT_SOURCE_ID = 1;

	constructor (board, {isCompact}) {
		super(board);
		this._isCompact = isCompact;
		this._sourceId = PlayerReferenceRoot._NEXT_SOURCE_ID++;
		this._rows = [];
		this._wrpRows = null;
	}

	render (eleParent) {
		const headers = this._isCompact ? null : veT`<div class="dm-player-ref__header-outer"><div class="dm-player-ref__header">
			<div>Name</div><div>AC</div><div>Prc</div><div>Ins</div><div>Inv</div><div></div>
		</div></div>`;
		this._wrpRows = this._isCompact
			? veT`<div class="dm-player-strip__cards"></div>`
			: veT`<div class="dm-player-ref__rows ve-overflow-y-auto"></div>`;
		const pod = this.getPod();
		this._renderRows();
		const btnAdd = veT`<button class="ve-btn ve-btn-primary ve-btn-xs ${this._isCompact ? "dm-player-strip__add" : ""}" title="Add Player" aria-label="Add Player"><span class="glyphicon glyphicon-plus"></span>${this._isCompact ? "" : " Add Player"}</button>`
			.vee.onn("click", () => {
				const row = new PlayerReferenceRow(this._board, () => this._doSyncSharedRows(), {isCompact: this._isCompact});
				this._rows.push(row);
				row.render(this._wrpRows, pod);
				this._doSyncSharedRows();
			});

		if (this._isCompact) {
			veT`<div class="dm-player-strip__layout"><div class="dm-player-strip__track">${this._wrpRows}${btnAdd}</div></div>`.vee.appendTo(eleParent);
			return;
		}

		veT`<div class="dm-player-ref__layout">
			${headers}
			${this._wrpRows}
			<div class="dm-player-ref__footer">${btnAdd}</div>
		</div>`.vee.appendTo(eleParent);
	}

	_renderRows () {
		if (!this._wrpRows) return;
		this._wrpRows.vee.empty();
		const pod = this.getPod();
		this._rows.forEach(row => row.render(this._wrpRows, pod));
	}

	_doSyncSharedRows () {
		this._board.setPlayerReferenceData(this._rows.map(row => row.getSaveableState()), {sourceId: this._sourceId});
	}

	onBoardEvent ({type, payload}) {
		if (type !== "playerReferenceData" || payload.sourceId === this._sourceId) return;
		this._rows = (payload.rows || []).map(rowState => {
			const row = new PlayerReferenceRow(this._board, null, {isCompact: this._isCompact});
			row.setStateFrom(rowState);
			row.setFnOnChange(() => this._doSyncSharedRows());
			return row;
		});
		this._renderRows();
	}

	_swapRowPositions (ixA, ixB) {
		[this._rows[ixA], this._rows[ixB]] = [this._rows[ixB], this._rows[ixA]];
		this._rows.forEach(row => row.eleRow.vee.detach().vee.appendTo(this._wrpRows));
		this._doSyncSharedRows();
	}

	_removeRow (row) {
		const ix = this._rows.indexOf(row);
		if (ix < 0) return;
		this._rows.splice(ix, 1);
		row.eleRow.remove();
		this._doSyncSharedRows();
	}

	getPod () {
		const pod = super.getPod();
		pod.swapRowPositions = this._swapRowPositions.bind(this);
		pod.removeRow = this._removeRow.bind(this);
		pod.getElesChildren = () => this._rows.map(row => row.eleRow);
		return pod;
	}

	setStateFrom (state = {}) {
		this.setBaseSaveableStateFrom(state);
		const sharedRows = this._board.getPlayerReferenceData();
		const rows = sharedRows ?? state.rows ?? [];
		if (sharedRows == null && Array.isArray(state.rows)) this._board.setPlayerReferenceData(rows, {sourceId: this._sourceId, isSilent: true});
		this._rows = rows.map(rowState => {
			const row = new PlayerReferenceRow(this._board, null, {isCompact: this._isCompact});
			row.setStateFrom(rowState);
			row.setFnOnChange(() => this._doSyncSharedRows());
			return row;
		});
	}

	getSaveableState () {
		return this.getBaseSaveableState();
	}
}

class PlayerReferenceRow extends PlayerReferenceComponent {
	constructor (board, fnOnChange, {isCompact}) {
		super(board);
		this._fnOnChange = fnOnChange;
		this._isCompact = isCompact;
		this._eleRow = null;
		this._addHookAll("state", () => this._fnOnChange?.());
	}

	get eleRow () { return this._eleRow; }
	setFnOnChange (fn) { this._fnOnChange = fn; }

	setStateFrom (state = {}) {
		this._proxyAssignSimple("state", {
			name: "",
			ac: "",
			acShield: "",
			passivePerception: "",
			passiveInsight: "",
			passiveInvestigation: "",
			notes: "",
			...state,
		});
	}

	getSaveableState () { return MiscUtil.copyFast(this._state); }

	_getInput (prop, {isNumeric = false, title = ""} = {}) {
		const input = veT`<input class="ve-form-control form-control--minimal dm-player-ref__input" title="${title}" aria-label="${title}">`;
		if (isNumeric) input.vee.attr("inputmode", "numeric");
		input.vee.val(this._state[prop] ?? "");
		input.vee.onn("input", () => {
			const value = input.vee.val();
			this._state[prop] = isNumeric && value !== "" ? String(value).replace(/[^\d-]/g, "") : value;
		});
		return input;
	}

	render (eleParent, parent) {
		this._parent = parent;
		const inputs = {
			name: this._getInput("name", {title: "Character name"}),
			ac: this._getInput("ac", {isNumeric: true, title: "Armor Class"}),
			perception: this._getInput("passivePerception", {isNumeric: true, title: "Passive Perception"}),
			insight: this._getInput("passiveInsight", {isNumeric: true, title: "Passive Insight"}),
			investigation: this._getInput("passiveInvestigation", {isNumeric: true, title: "Passive Investigation"}),
		};
		const inputShield = this._getInput("acShield", {isNumeric: true, title: "Armor Class with shield"});
		inputShield.vee.attr("placeholder", "S");
		const eleShield = veT`<span class="dm-player-ref__shield">/ ${inputShield}</span>`;
		const btnRemove = veT`<button class="ve-btn ve-btn-danger ve-btn-xxs" title="Remove player" aria-label="Remove player"><span class="glyphicon glyphicon-trash"></span></button>`
			.vee.onn("click", () => this._parent.removeRow(this));
		const padDrag = DragReorderUiUtil.getDragPad2(() => this._eleRow, eleParent, this._parent);
		if (this._isCompact) {
			const passives = veT`<div class="dm-player-strip__passives">
				<label><span>Prc</span>${inputs.perception}</label>
				<label><span>Ins</span>${inputs.insight}</label>
				<label><span>Inv</span>${inputs.investigation}</label>
			</div>`;
			const notes = this._getNotesInput();
			this._eleRow = veT`<div class="dm-player-strip__card">
				<div class="dm-player-strip__name">${inputs.name}</div>
				<div class="dm-player-strip__actions">${padDrag}${btnRemove}</div>
				<div class="dm-player-strip__ac"><span>AC</span>${inputs.ac}${eleShield}</div>
				${passives}
				${notes}
			</div>`.vee.appendTo(eleParent);
			return;
		}
		const stats = veT`<div class="dm-player-ref__stats-outer"><div class="dm-player-ref__stats">
			${inputs.name}
			<div class="dm-player-ref__ac">${inputs.ac}${eleShield}</div>
			${inputs.perception}${inputs.insight}${inputs.investigation}
			<div class="dm-player-ref__actions">${padDrag}${btnRemove}</div>
		</div></div>`;
		const notes = this._getNotesInput();
		this._eleRow = veT`<div class="dm-player-ref__row">${stats}${notes}</div>`.vee.appendTo(eleParent);
	}

	_getNotesInput () {
		const notes = veT`<textarea rows="1" class="ve-form-control form-control--minimal dm-player-ref__input dm-player-ref__notes" title="Additional character notes" aria-label="Additional character notes" placeholder="Notes"></textarea>`;
		if (this._isCompact) {
			notes.vee.addClass("dm-player-strip__notes");
			notes.vee.attr("placeholder", "Notes");
		}
		notes.vee.val(this._state.notes ?? "");
		notes.vee.onn("input", () => this._state.notes = notes.vee.val());
		return notes;
	}
}
