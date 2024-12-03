var current = { id: -1, };
function reset_loaded()
{
	current.set = null;
	current.local = null;
	current.notes = [];
	current.rp = null;
	current.assessment = { pass: true, };
}
var assetList = [];

function __noop(event)
{
	event.stopPropagation();
	event.preventDefault();
}

document.ondragover = __noop;
document.ondragenter = __noop;

document.ondrop = function(event)
{
	event.preventDefault();
	for (const file of event.dataTransfer.files)
	{
		let idregex = file.name.match(/^(\d+)/);
		let thisid = +idregex[1] || -1;
		if (thisid != current.id)
		{
			current.id = thisid;
			reset_loaded();
		}
		
		let reader = new FileReader();
		if (file.name.endsWith('-Notes.json'))
			reader.onload = function(event)
			{
				try
				{
					let data = JSON.parse(event.target.result);
					load_code_notes(data);
				}
				catch (e)
				{
					if (e instanceof LogicParseError) alert(e.message);
					else console.error(e);
				}
			};
		else if (file.name.endsWith('.json'))
			reader.onload = function(event)
			{
				try
				{
					let data = JSON.parse(event.target.result);
					load_achievement_set(data);
				}
				catch (e)
				{
					if (e instanceof LogicParseError) alert(e.message);
					else console.error(e);
				}
			};
		else if (file.name.endsWith('-Rich.txt'))
			reader.onload = function(event)
			{
				try
				{
					let data = event.target.result;
					load_rich_presence(data, true);
				}
				catch (e)
				{
					if (e instanceof LogicParseError) alert(e.message);
					else console.error(e);
				}
			};
		else if (file.name.endsWith('-User.txt'))
			reader.onload = function(event)
			{
				try
				{
					let data = event.target.result;
					load_user_file(data);
				}
				catch (e)
				{
					if (e instanceof LogicParseError) alert(e.message);
					else console.error(e);
				}
			};
		reader.readAsText(file);
	}
}

document.onkeydown = function(event)
{
	let handled = true;
	let crow = document.querySelector('.asset-row.selected');
	switch (event.key)
	{
		case "Up":
		case "ArrowUp":
			for (let n = crow.previousSibling; n; n = n.previousSibling)
				if (n.classList.contains('asset-row')) { n.click(); break; }
			break;
		case "Down":
		case "ArrowDown":
			for (let n = crow.nextSibling; n; n = n.nextSibling)
				if (n.classList.contains('asset-row')) { n.click(); break; }
			break;
		default:
			handled = false;
	}

	if (handled)
	{
		event.preventDefault();
		event.stopPropagation();
	}
}

function get_note(v)
{
	let addr = +v, note = null;
	for (const cn of current.notes || [])
		if (cn.contains(addr)) note = cn;
	if (!note) return null;

	let note_text = "";
	let relevant_text = note.note;
	if (addr != note.addr)
	{
		let base = '0x' + note.addr.toString(16).padStart(8, '0');
		let offset = '0x' + (addr - note.addr).toString(16);
		note_text += `[Indirect ${base} + ${offset}]\n`;
	}
	note_text += relevant_text;
	return note_text;
}

async function copyToClipboard(text)
{
	try {
		await navigator.clipboard.writeText(text);
	} catch (error) {
		console.error(error.message);
	}
}

function make_logic_table(logic, assessment = [])
{
	let logictbl = document.createElement('table');
	let logicbody = document.createElement('tbody');

	let grouplabel = (i) => i == 0 ? "Core Group" : `Alt Group ${i}`
	if (logic.value) grouplabel = (i) => `Value Group ${i+1}`;

	for (const [gi, g] of logic.groups.entries())
	{
		const HEADERS = ["id", "Flag", "Type", "Size", "Mem/Val", "Cmp", "Type", "Size", "Mem/Val", "Hits"];

		// name the group
		let titlerow = document.createElement('tr');
		titlerow.classList.add('group-hdr', 'header')
		let titlecell = document.createElement('td');
		titlecell.appendChild(document.createTextNode(grouplabel(gi)));
		titlecell.setAttribute('colspan', HEADERS.length);
		titlerow.appendChild(titlecell);
		logicbody.appendChild(titlerow);

		// column headers
		let hdrrow = document.createElement('tr');
		hdrrow.classList.add('col-hdr', 'header')
		for (const hdr of HEADERS)
		{
			let td = document.createElement('td');
			td.appendChild(document.createTextNode(hdr));
			hdrrow.appendChild(td);
		}
		logicbody.appendChild(hdrrow);

		for (const [ri, req] of g.entries())
		{
			let reqrow = document.createElement('tr');
			
			let ref_list = [];
			for (const [ii, issue] of assessment.entries())
				if (issue.target == req)
				{
					reqrow.classList.add('warn');
					ref_list.push(ii);
				}
			let reqdata = ["", "", "", "", "", "", "", "", "", ""];

			reqdata[0] = "" + (ri + 1) + ref_list.map(x => ` <sup>(#${x+1})</sup>`).join('');
			if (req.flag) reqdata[1] = req.flag.name;
			reqdata[2] = req.lhs.type.name;
			if (req.lhs.size) reqdata[3] = req.lhs.size.name;
			reqdata[4] = req.lhs.type.addr ? ('0x' + req.lhs.value.padStart(8, '0')) : req.lhs.value;
			if (req.op && req.rhs)
			{
				reqdata[5] = req.op;
				reqdata[6] = req.rhs.type.name;
				if (req.rhs.size) reqdata[7] = req.rhs.size.name;
				reqdata[8] = req.rhs.type.addr ? ('0x' + req.rhs.value.padStart(8, '0')) : req.rhs.value;
				if (!req.flag || req.flag.hits) reqdata[9] = "(" + req.hits + ")";
			}

			for (const v of reqdata)
			{
				let td = document.createElement('td');
				let span = td.appendChild(document.createElement('span'));
				span.innerHTML = v;
				if (typeof v === 'string' && v.startsWith('0x'))
				{
					let note = get_note(v);
					if (note)
					{
						span.classList.add('tooltip');
						let tooltip = span.appendChild(document.createElement('span'));
						tooltip.classList.add('tooltip-info');
						let pre = tooltip.appendChild(document.createElement('pre'));
						pre.appendChild(document.createTextNode(note));
					}
				}
				reqrow.appendChild(td);
			}
			logicbody.appendChild(reqrow);
		}
	}
	logictbl.appendChild(logicbody);
	return logictbl;
}

function make_issue_list_entry(ii, issue)
{
	let text = `<sup>(#${ii+1})</sup> ${issue.type.desc}`;
	for (const ref of issue.type.ref)
		text += ` <sup>[<a href="${ref}">ref</a>]</sup>`;
	text += issue.detail.map(x => "<br/>" + x).join('');
	return text;
}

function get_logic_stats(stats, logic = null)
{
	let statslist = document.createElement('ul');

	let sublist;
	if (logic != null)
		statslist.appendChild(document.createElement('li'))
			.appendChild(document.createTextNode(`Memory Length: ${logic.mem.length}/65535`));
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode(`Group Count: ${stats.group_count} (1 Core + ${z = stats.alt_groups} Alt${z == 1 ? '' : 's'})`));

	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode(`Requirement Count: ${stats.cond_count}`));
	sublist = statslist.appendChild(document.createElement('ul'));
	sublist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode(`Max Requirements Per Group: ${stats.group_maxsize}`));
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `<span title="A sequence of achievements linked by flags">Longest Chain</span>: ${stats.max_chain}`;
	
	let warn = stats.addresses.size <= 1 ? "☠️" : (stats.oca ? "⚠️" : "");
	statslist.appendChild(document.createElement('li'))
		.innerHTML = `Addresses: ${stats.addresses.size} (${stats.virtual_addresses.size} <span title="addresses constructed via a series of AddAddress flags">virtual addresses</span>) ${warn}`;

	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode("Logic Features"));
	sublist = statslist.appendChild(document.createElement('ul'));
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `<code>Delta</code>s: ${stats.deltas} / <code>Prior</code>s: ${stats.priors} ${stats.deltas + stats.priors == 0 ? '⚠️': ''}`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Unique Flags: (${stats.unique_flags.size}) ` + 
		[...stats.unique_flags].map(x => `<code>${x.name}</code>`).join(', ');
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `<span title="Excluding 8-bit and Bit values">Unique Mem Sizes</span>: (${stats.unique_sizes.size}) ` +
		[...stats.unique_sizes].map(x => `<code>${x.name}</code>`).join(', ');
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Unique Comparisons: (${stats.unique_cmps.size}) ` +
		[...stats.unique_cmps].map(x => `<code>${x}</code>`).join(', ');
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Source Modifications: ` +
		[...stats.source_modification.entries()].filter(([op, c]) => c > 0).map(([op, c]) => `<code>${op}</code> (${c})`).join(', ');

	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode(`Requirements with hitcounts: ${stats.hit_counts_one + stats.hit_counts_many}`));
	sublist = statslist.appendChild(document.createElement('ul'));
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `<span title="a checkpoint hit is a hitcount of 1, which locks when satisfied">Checkpoint hits</span>: ${stats.hit_counts_one}`;

	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode("Pauses and Resets"));
	sublist = statslist.appendChild(document.createElement('ul'));
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `<code>PauseIf</code>s: ${stats.pause_ifs} (${z = stats.pause_locks} <span title="a PauseLock is a PauseIf with a hitcount">PauseLock${z == 1 ? '' : 's'}</span>)`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `<code>ResetIf</code>s: ${stats.reset_ifs} (${stats.reset_with_hits} with hits)`;

	return statslist;
}

function show_achievement(ach, row)
{
	let z;
	let feedback = current.assessment.achievements.get(ach.id);
	let feedback_targets = new Set(feedback.issues.map(x => x.target));

	let elts = [];
	let infobox = document.createElement('div');
	elts.push(infobox);

	if (ach.badge)
	{
		let achlink = infobox.appendChild(document.createElement('a'));
		achlink.setAttribute('href', `https://retroachievements.org/achievement/${ach.id}`);
		let badge = achlink.appendChild(document.createElement('img'));
		badge.classList.add('icon');
		badge.setAttribute('src', ach.badge);
	}

	let header = infobox.appendChild(document.createElement('h2'));
	let title_mod = ach.title;
	if (feedback_targets.has('title'))
		title_mod = `<span class="warn">${title_mod}</span>`;
	header.innerHTML = `🏆 ${title_mod} (${ach.points})`;
	header.classList.add('ach-title');

	let labels = [];
	if (ach.state) labels.push(ach.state.name);
	if (ach.achtype) labels.push(ach.achtype);

	if (labels.length)
	{
		let labeldiv = infobox.appendChild(document.createElement('div'));
		labeldiv.classList.add('float-right');

		let label = labeldiv.appendChild(document.createElement('em'));
		label.appendChild(document.createTextNode(`[${labels.join(', ')}]`));
	}

	let desc = infobox.appendChild(document.createElement('p'));
	let desc_mod = ach.desc;
	if (feedback_targets.has('desc'))
		desc_mod = `<span class="warn">${desc_mod}</span>`;
	desc.innerHTML = desc_mod;
	desc.classList.add('ach-desc');

	let logicdiv = document.createElement('div');
	logicdiv.classList.add('data-table');
	logicdiv.appendChild(make_logic_table(ach.logic, feedback.issues));
	elts.push(logicdiv);
	
	let btndiv = logicdiv.appendChild(document.createElement('div'));
	btndiv.classList.add('float-right');
	let btn = btndiv.appendChild(document.createElement('button'));
	btn.appendChild(document.createTextNode('Copy Markdown'));
	btn.onclick = () => copyToClipboard(ach.logic.toMarkdown());
	
	let statsdiv = document.createElement('div');
	statsdiv.classList.add('stats');
	elts.push(statsdiv);

	statsdiv.appendChild(document.createElement('h1'))
		.appendChild(document.createTextNode('Statistics'));

	const stats = feedback.stats;
	statsdiv.appendChild(get_logic_stats(stats, ach.logic));

	if (feedback.issues.length > 0)
	{
		let feedbackdiv = document.createElement('div');
		feedbackdiv.classList.add('feedback');
		elts.push(feedbackdiv);

		feedbackdiv.appendChild(document.createElement('h1'))
			.appendChild(document.createTextNode('Feedback'));

		let cissues;
		cissues = [...feedback.issues.entries()].filter(([i, x]) => ['title', 'desc'].includes(x.target));
		if (cissues.length > 0)
		{
			feedbackdiv.appendChild(document.createElement('h2'))
				.appendChild(document.createTextNode('Presentation & Writing'));
			let ul = feedbackdiv.appendChild(document.createElement('ul'));
			for (const [ii, issue] of cissues)
			{
				let li = ul.appendChild(document.createElement('li'));
				li.innerHTML = make_issue_list_entry(ii, issue);
			}
		}

		cissues = [...feedback.issues.entries()].filter(([i, x]) => !['title', 'desc'].includes(x.target));
		if (cissues.length > 0)
		{
			feedbackdiv.appendChild(document.createElement('h2'))
				.appendChild(document.createTextNode('Logic & Design'));
			let ul = feedbackdiv.appendChild(document.createElement('ul'));
			for (const [ii, issue] of cissues)
			{
				let li = ul.appendChild(document.createElement('li'));
				li.innerHTML = make_issue_list_entry(ii, issue);
			}
		}
	}

	document.getElementById('info-container').replaceChildren(...elts);
	document.getElementById('asset-info').scrollTop = 0;
	select_row(row);
}

function show_leaderboard(lb, row)
{
	let z;
	let feedback = current.assessment.leaderboards.get(lb.id);
	let feedback_targets = new Set(feedback.issues.map(x => x.target));

	let elts = [];
	let infobox = document.createElement('div');
	infobox.classList.add('main-header');
	elts.push(infobox);

	if (current.set && current.set.icon)
	{
		let badge = infobox.appendChild(document.createElement('img'));
		badge.classList.add('icon');
		badge.setAttribute('src', current.set.icon);
	}

	let header = infobox.appendChild(document.createElement('h2'));
	let title_mod = lb.title;
	if (feedback_targets.has('title'))
		title_mod = `<span class="warn">${title_mod}</span>`;
	header.innerHTML = `📊 ${title_mod}`;
	header.classList.add('ach-title');

	let labels = [];
	if (lb.state) labels.push(lb.state.name);

	if (labels.length)
	{
		let labeldiv = infobox.appendChild(document.createElement('div'));
		labeldiv.classList.add('float-right');

		let label = labeldiv.appendChild(document.createElement('em'));
		label.appendChild(document.createTextNode(`[${labels.join(', ')}]`));
	}

	let desc = infobox.appendChild(document.createElement('p'));
	let desc_mod = lb.desc;
	if (feedback_targets.has('desc'))
		desc_mod = `<span class="warn">${desc_mod}</span>`;
	desc.innerHTML = desc_mod;
	desc.classList.add('ach-desc');

	let logicdiv = document.createElement('div');
	logicdiv.classList.add('data-table');
	for (const block of ["START", "CANCEL", "SUBMIT", "VALUE"])
	{
		logicdiv.appendChild(document.createElement('h3')).appendChild(document.createTextNode(block));
		logicdiv.appendChild(make_logic_table(lb.components[block.substring(0, 3)]));
	}
	elts.push(logicdiv);

	let statsdiv = document.createElement('div');
	statsdiv.classList.add('stats');
	elts.push(statsdiv);

	statsdiv.appendChild(document.createElement('h1'))
		.appendChild(document.createTextNode('Statistics'));

	let statslist = statsdiv.appendChild(document.createElement('ul'));
	statslist.appendChild(document.createElement('li'))
		.innerHTML = `Format: <code>${lb.format.name}</code>`;
	statslist.appendChild(document.createElement('li'))
		.innerHTML = `Lower is better? <strong>${lb.lower_is_better ? "yes" : "no"}</strong>`;
	
	let buttonpanel = statsdiv.appendChild(document.createElement('div'));
	let statsbox = statsdiv.appendChild(document.createElement('div'));

	let buttons = ["START", "CANCEL", "SUBMIT", "VALUE"].map(c =>
	{
		let btn = document.createElement('button');
		btn.appendChild(document.createTextNode(c));
		btn.onclick = function() {
			let tag = c.substring(0, 3);
			let hdr = document.createElement('h2');
			hdr.appendChild(document.createTextNode(c));
			statsbox.replaceChildren(hdr, get_logic_stats(feedback.stats[tag], lb.components[tag]));
		}
		return btn;
	});
	buttonpanel.replaceChildren(...buttons);
	buttons[0].click();

	if (feedback.issues.length > 0)
	{
		let feedbackdiv = document.createElement('div');
		feedbackdiv.classList.add('feedback');
		elts.push(feedbackdiv);

		feedbackdiv.appendChild(document.createElement('h1'))
			.appendChild(document.createTextNode('Feedback'));

		let cissues;
		cissues = [...feedback.issues.entries()].filter(([i, x]) => ['title', 'desc'].includes(x.target));
		if (cissues.length > 0)
		{
			feedbackdiv.appendChild(document.createElement('h2'))
				.appendChild(document.createTextNode('Presentation & Writing'));
			let ul = feedbackdiv.appendChild(document.createElement('ul'));
			for (const [ii, issue] of cissues)
			{
				let li = ul.appendChild(document.createElement('li'));
				li.innerHTML = make_issue_list_entry(ii, issue);
			}
		}

		cissues = [...feedback.issues.entries()].filter(([i, x]) => !['title', 'desc'].includes(x.target));
		if (cissues.length > 0)
		{
			feedbackdiv.appendChild(document.createElement('h2'))
				.appendChild(document.createTextNode('Logic & Design'));
			let ul = feedbackdiv.appendChild(document.createElement('ul'));
			for (const [ii, issue] of cissues)
			{
				let li = ul.appendChild(document.createElement('li'));
				li.innerHTML = make_issue_list_entry(ii, issue);
			}
		}
	}

	document.getElementById('info-container').replaceChildren(...elts);
	document.getElementById('asset-info').scrollTop = 0;
	select_row(row);
}

function show_set_overview(sidebar)
{
	let z;
	const achievements = all_achievements();
	const leaderboards = all_leaderboards();
	if (achievements.length == 0 && leaderboards.length == 0) return;
	
	const feedback = current.assessment.set;
	const stats = feedback.stats;
	let elts = [];

	let infobox = document.createElement('div');
	infobox.classList.add('main-header');
	elts.push(infobox);

	if (current.set)
	{
		let badge = infobox.appendChild(document.createElement('img'));
		badge.classList.add('icon');
		badge.setAttribute('src', current.set.icon);
	}

	infobox.appendChild(document.createElement('h1'))
		.appendChild(document.createTextNode(get_game_title()));

	let set_components = [];
	if (achievements.length > 0)
	{
		let achinfo = `${achievements.length} achievement`;
		if (achievements.length != 1) achinfo += 's';

		// mixed achievement state
		const achstates = [...feedback.stats.achievement_state.entries()].filter(([x, c]) => c > 0);
		if (achstates.length > 1) achinfo += ` (${achstates.map(([x, c]) => `${c} ${x.name}`).join(', ')})`;
		set_components.push(achinfo);
	}

	if (leaderboards.length > 0)
		set_components.push(`${z = leaderboards.length} leaderboard${z == 1 ? '' : 's'}`);

	infobox.appendChild(document.createElement('p'))
		.innerHTML = `Set contains ${set_components.join(' and ')}`;

	let statsdiv = document.createElement('div');
	statsdiv.classList.add('stats');
	elts.push(statsdiv);

	let chartdiv, chartdata, COLORS;

	chartdiv = statsdiv.appendChild(document.createElement('div'));

	chartdiv.appendChild(document.createElement('h3')).innerText = 'Achievement Typing'
	chartdiv.classList.add('chart', 'float-right');
	chartdata = [...stats.achievement_type.entries()];
	COLORS = { '': '#FBDD70', 'progression': '#8DD7E1', 'win_condition': '#A36FD4', 'missable': '#F28590', };
	new Chart(
		chartdiv.appendChild(document.createElement('canvas')),
		{
			type: 'doughnut',
			data: {
				labels: chartdata.map(([k,v]) => k ? k : '(none)'),
				datasets: [
					{
						label: 'achievement count',
						data: chartdata.map(([k,v]) => v.length),
						backgroundColor: chartdata.map(([k,v]) => COLORS[k]),
					}
				]
			},
		}
	);

	statsdiv.appendChild(document.createElement('h1'))
		.appendChild(document.createTextNode('Statistics'));

	let statslist = statsdiv.appendChild(document.createElement('ul'));
	let sublist;

	/*******************
		ACHIEVEMENTS
	*******************/
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode("Achievements"));
	sublist = statslist.appendChild(document.createElement('ul'));

	sublist.appendChild(document.createElement('li'))
		.innerHTML = `${stats.achievement_count} achievements: ` + 
		[...stats.achievement_type.entries()].map(([k,v]) => `${v.length} ${k ? k : 'standard'}`).join(', ');
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Total points: ${stats.total_points}`;
	
	let avg_feedback = '';
	if (Math.round(stats.avg_points) <  5) avg_feedback = ' <strong>(low)</strong>';
	if (Math.round(stats.avg_points) <  4) avg_feedback = ' <strong>(very low)</strong>';
	if (Math.round(stats.avg_points) > 10) avg_feedback = ' <strong>(high)</strong>';
	if (Math.round(stats.avg_points) > 15) avg_feedback = ' <strong>(very high)</strong>';

	sublist.appendChild(document.createElement('li'))
		.innerHTML = `<span title="~7 points per achievement is a good target">Average points</span>: ~${stats.avg_points.toFixed(1)}${avg_feedback}`;
	
	/*******************
		LEADERBOARDS
	*******************/
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode("Leaderboards"));
	sublist = statslist.appendChild(document.createElement('ul'));

	sublist.appendChild(document.createElement('li'))
		.innerHTML = `${stats.leaderboard_count} leaderboards &ndash; <span title="determined heuristically">type breakdown</span>: ` + 
		[...stats.leaderboard_type.entries()].map(([k,v]) => `${v.length} ${k}`).join(', ');

	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Instant submission leaderboards: ${stats.lb_instant_submission}`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Leaderboards with complex/conditional value: ${stats.lb_conditional_value}`;

	
	if (current.rp != null)
	{
		if (!current.assessment.rp.stats.is_dynamic_rp)
			statslist.appendChild(document.createElement('li'))
				.innerHTML = `<strong>No dynamic Rich Presence</strong> ⚠️`;
	}
	
	/*******************
		PROFICIENCIES
	*******************/
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode("Proficiencies"));
	sublist = statslist.appendChild(document.createElement('ul'));

	let vp = (x) => `${x.length} (${Math.round(100 * x.length / stats.achievement_count)}%)`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Flags used (${stats.all_flags.size}): ${[...stats.all_flags].map(x => `<code>${x.name}</code>`).join(', ')}`;
	
	let flagbreakdown = sublist.appendChild(document.createElement('ul'));
	for (const k of stats.all_flags)
		flagbreakdown.appendChild(document.createElement('li'))
			.innerHTML = `<code>${k.name}</code> used in ${z = stats.using_flag.get(k)} achievement${z == 1 ? '' : 's'}`;

	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Comparisons used (${stats.all_cmps.size}): ${[...stats.all_cmps].map(x => `<code>${x}</code>`).join(', ')}`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Sizes used (${stats.all_sizes.size}): ${[...stats.all_sizes].map(x => `<code>${x.name}</code>`).join(', ')}`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Achievements using <span title="Delta and Prior checks combined">Delta checks</span>: ${vp(stats.using_delta)}`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Achievements using Alt groups: ${stats.using_alt_groups.length}`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Achievements using hitcounts: ${stats.using_hitcounts.length}`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Achievements using <span title="requirements with a hitcount of 1">checkpoint hits</span>: ${stats.using_checkpoint_hits.length}`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Achievements using <span title="BitX and BitCount memory sizes">bit operations</span>: ${stats.using_bit_ops.length}`;
	sublist.appendChild(document.createElement('li'))
		.innerHTML = `Achievements using <span title="PauseIf with a hitcount">PauseLocks</span>: ${stats.using_pauselock.length} (${stats.using_pauselock_alt_reset.length} with Alt reset)`;
	
	let cissues = [...feedback.issues.entries()];
	if (cissues.length > 0)
	{
		let feedbackdiv = document.createElement('div');
		feedbackdiv.classList.add('feedback');
		elts.push(feedbackdiv);

		feedbackdiv.appendChild(document.createElement('h1'))
			.appendChild(document.createTextNode('Feedback'));
		
		let ul = feedbackdiv.appendChild(document.createElement('ul'));
		for (const [ii, issue] of cissues)
		{
			let li = ul.appendChild(document.createElement('li'));
			li.innerHTML = make_issue_list_entry(ii, issue);
		}
	}

	document.getElementById('info-container').replaceChildren(...elts);
	document.getElementById('asset-info').scrollTop = 0;
	select_row(sidebar);
}

function show_code_notes(sidebar)
{
	if (current.notes == null) return;
	let elts = [];

	let infobox = document.createElement('div');
	infobox.classList.add('main-header');
	elts.push(infobox);

	let header;
	if (current.set != null)
	{
		let anchor = infobox.appendChild(document.createElement('a'));
		anchor.setAttribute('href', `https://retroachievements.org/codenotes.php?g=${current.id}`);
		let badge = anchor.appendChild(document.createElement('img'));
		badge.classList.add('icon');
		badge.setAttribute('src', current.set.icon);

		header = infobox.appendChild(document.createElement('h1'));
		header.appendChild(document.createTextNode(get_game_title()));
	}

	let authors = new Set(current.notes.map(x => x.author));
	infobox.appendChild(document.createElement('p'))
		.innerHTML = `There are <a href="https://retroachievements.org/codenotes.php?g=${current.id}">${current.notes.length} code notes</a> by ${authors.size} author(s): ${[...authors].join(', ')}`;
	if (!current.assessment.notes.pass())
		infobox.appendChild(document.createElement('p'))
			.appendChild(document.createTextNode(`⚠️ There are ${current.assessment.notes.issues.length} issues to resolve`));

	const HEADERS = ['Address', 'Note', 'Author'];
	let tablediv = document.createElement('div');
	tablediv.classList.add('data-table');
	let table = tablediv.appendChild(document.createElement('table'));
	table.classList.add('code-notes');

	let tblhdr = table.appendChild(document.createElement('thead'));
	let titlerow = tblhdr.appendChild(document.createElement('tr'));
	titlerow.classList.add('group-hdr', 'header')
	let titlecell = titlerow.appendChild(document.createElement('td'));
	titlecell.appendChild(document.createTextNode("Code Notes"));
	titlecell.setAttribute('colspan', HEADERS.length);
	let hdrrow = tblhdr.appendChild(document.createElement('tr'));
	for (const hdr of HEADERS)
		hdrrow.appendChild(document.createElement('td')).appendChild(document.createTextNode(hdr));

	let tbody = table.appendChild(document.createElement('tbody'));
	for (const note of current.notes)
	{
		let row = ["", "", ""];
		let addrinfo = '0x' + note.addr.toString(16).padStart(8, '0');
		if (note.size > 8) addrinfo += '<br/>- ' + '0x' + (note.addr + note.size - 1).toString(16).padStart(8, '0');

		let tr = tbody.appendChild(document.createElement('tr'));
		tr.appendChild(document.createElement('td')).innerHTML = addrinfo;
		tr.appendChild(document.createElement('td'))
			.appendChild(document.createElement('pre'))
			.appendChild(document.createTextNode(note.note));

		for (const issue of current.assessment.notes.issues)
			if (issue.target == note)
				tr.classList.add('warn');
		
		let author = tr.appendChild(document.createElement('td'));
		let tt = author.appendChild(document.createElement('span'));
		tt.classList.add('tooltip');
		let anchor = tt.appendChild(document.createElement('a'));
		anchor.setAttribute('href', `https://retroachievements.org/user/${note.author}`);
		let img = anchor.appendChild(document.createElement('img'))
		img.setAttribute('src', `https://media.retroachievements.org/UserPic/${note.author}.png`);
		img.setAttribute('width', 24);
		img.setAttribute('height', 24);
		let ttinfo = tt.appendChild(document.createElement('span'));
		ttinfo.classList.add('tooltip-info');
		ttinfo.appendChild(document.createTextNode(note.author));
	}
	elts.push(tablediv);

	let statsdiv = document.createElement('div');
	statsdiv.classList.add('stats');
	elts.push(statsdiv);

	statsdiv.appendChild(document.createElement('h1'))
		.appendChild(document.createTextNode('Statistics'));

	const stats = current.assessment.notes.stats;
	let statslist = statsdiv.appendChild(document.createElement('ul'));
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode(`${stats.notes_count} code notes (${stats.notes_used} used, ${stats.notes_unused} unused)`));
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode('Sizes noted'));
	let sizelist = statslist.appendChild(document.createElement('ul'));
	for (const [k,v] of stats.size_counts.entries())
		sizelist.appendChild(document.createElement('li')).innerHTML = `<code>${k}</code>: ${v}`;
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode('Author contributions'));
	let authorlist = statslist.appendChild(document.createElement('ul'));
	for (const [k,v] of stats.author_counts.entries())
		authorlist.appendChild(document.createElement('li')).innerHTML = `${k}: ${v} (${(100 * v / stats.notes_count).toFixed(1)}%)`;

	let feedbackdiv = document.createElement('div');
	feedbackdiv.classList.add('feedback');
	elts.push(feedbackdiv);

	feedbackdiv.appendChild(document.createElement('h1'))
		.appendChild(document.createTextNode('Feedback'));

	function make_issue_list_entry(ii, issue)
	{
		let text = `<sup>(#${ii+1})</sup> <code>0x${issue.target.addr.toString(16).padStart(8, '0')}</code> &mdash; ${issue.type.desc}`;
		for (const ref of issue.type.ref)
			text += ` <sup>[<a href="${ref}">ref</a>]</sup>`;
		if (issue.detail) text += "<br/>" + issue.detail;
		return text;
	}

	let cissues = [...current.assessment.notes.issues.entries()];
	if (cissues.length > 0)
	{
		let ul = feedbackdiv.appendChild(document.createElement('ul'));
		for (const [ii, issue] of cissues)
		{
			let li = ul.appendChild(document.createElement('li'));
			li.innerHTML = make_issue_list_entry(ii, issue);
		}
	}

	document.getElementById('info-container').replaceChildren(...elts);
	document.getElementById('asset-info').scrollTop = 0;
	select_row(sidebar);
}

function show_rich_presence(sidebar)
{
	if (current.rp == null) return;
	let elts = [];

	let z;
	const feedback = current.assessment.rp;

	let infobox = document.createElement('div');
	infobox.classList.add('main-header');
	elts.push(infobox);

	let header;
	if (current.set != null)
	{
		let badge = infobox.appendChild(document.createElement('img'));
		badge.classList.add('icon');
		badge.setAttribute('src', current.set.icon);

		header = infobox.appendChild(document.createElement('h1'));
		header.appendChild(document.createTextNode(get_game_title()));
	}

	let rpdiv = document.createElement('div');
	rpdiv.classList.add('rich-presence');
	elts.push(rpdiv);

	function addLookups(t)
	{ return t.replaceAll(/(@([_a-z][_a-z0-9]*)\((.+?)\))/gi, '<span class="lookup">@<span class="link">$2</span>(<span class="value logic">$3</span>)</span>'); }

	let display = false;
	rptext = current.rp.text.split(/\r\n|(?!\r\n)[\n-\r\x85\u2028\u2029]/g).map(line => {
		line = line.trim();
		if (display) line = line.startsWith('?')
			? line.replaceAll(/\?(.+)\?(.+)/g, (_, p1, p2) => `?<span class="condition logic">${p1}</span>?${addLookups(p2)}`)
			: addLookups(line);
		if (line.startsWith('Display:')) display = true;
		return line;
	}).join('\n');
	rptext = rptext.replaceAll(/((Lookup|Format|Display):(\S*))/g, '<span class="header" id="def-$3">$1</span>');

	rpdiv.appendChild(document.createElement('pre'))
		.appendChild(document.createElement('code'))
		.innerHTML = rptext;

	let logicdiv = document.createElement('div');
	logicdiv.classList.add('data-table');
	elts.push(logicdiv);

	let statsdiv = document.createElement('div');
	statsdiv.classList.add('stats');
	elts.push(statsdiv);

	statsdiv.appendChild(document.createElement('h1'))
		.appendChild(document.createTextNode('Statistics'));
	
	const stats = feedback.stats;
	let sublist;
	let statslist = statsdiv.appendChild(document.createElement('ul'));
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode(`Memory size: ${stats.mem_length}/65535`));
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode(`Custom macros (${stats.custom_macros.size})`));
	
	sublist = statslist.appendChild(document.createElement('ul'));
	for (const [k, v] of stats.custom_macros.entries())
		sublist.appendChild(document.createElement('li')).innerHTML = `<code>${k}</code> &xrArr; <code>${v.type}</code>`;
	
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode(`Lookups: ${stats.lookups.size} (${[...stats.lookups.values()].filter(lookup => lookup.some(x => x.isFallback())).length} with default values)`));
	statslist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode(`Display clauses: ${stats.display_groups} (${stats.cond_display} conditional displays)`));
	sublist = statslist.appendChild(document.createElement('ul'));
	sublist.appendChild(document.createElement('li'))
		.appendChild(document.createTextNode(`Most lookups in one display clause: ${stats.max_lookups}`));

	let cissues = [...feedback.issues.entries()];
	if (cissues.length > 0)
	{
		let feedbackdiv = document.createElement('div');
		feedbackdiv.classList.add('feedback');
		elts.push(feedbackdiv);

		feedbackdiv.appendChild(document.createElement('h1'))
			.appendChild(document.createTextNode('Feedback'));
		
		let ul = feedbackdiv.appendChild(document.createElement('ul'));
		for (const [ii, issue] of cissues)
		{
			let li = ul.appendChild(document.createElement('li'));
			li.innerHTML = make_issue_list_entry(ii, issue);
		}
	}

	document.getElementById('info-container').replaceChildren(...elts);
	document.getElementById('asset-info').scrollTop = 0;
	select_row(sidebar);

	for (let elt of document.querySelectorAll('.rich-presence .link'))
		elt.onclick = (x) => { document.getElementById(`def-${elt.innerText}`).scrollIntoView({behavior: 'smooth', block: 'nearest'}); }

	for (let elt of document.querySelectorAll('.rich-presence .logic'))
		elt.onclick = (x) => {
			for (let e2 of document.querySelectorAll('.rich-presence .logic.selected'))
				e2.classList.remove('selected');
			elt.classList.add('selected');

			const logic = Logic.fromString(elt.innerText, elt.classList.contains('value'));
			logicdiv.replaceChildren(make_logic_table(logic));
			logicdiv.scrollIntoView({behavior: 'smooth', block: 'nearest'});
		}
}

function add_asset_row(type, asset_name, callback = null)
{
	let tr = document.createElement('tr');
	tr.classList.add('asset-row', type);

	let td_asset_name = document.createElement('td');
	td_asset_name.classList.add('asset-name');
	td_asset_name.appendChild(document.createTextNode(asset_name));
	tr.appendChild(td_asset_name);

	tr.onclick = callback;
	return tr;
}

function select_row(row)
{
	for (let tr of document.getElementById('list-body').children)
		tr.classList.remove('selected');
	row.classList.add('selected');
	row.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

function get_game_title()
{
	if (current.set  ) return current.set.title;
	if (current.local) return current.local.title;
	return null;
}

function all_achievements()
{
	let res = [];
	if (current.set  ) res = res.concat(current.set.achievements);
	if (current.local) res = res.concat(current.local.achievements);
	return res;
}

function all_leaderboards()
{
	let res = [];
	if (current.set  ) res = res.concat(current.set.leaderboards);
	if (current.local) res = res.concat(current.local.leaderboards);
	return res;
}

function update_assessment()
{
	current.assessment.achievements = new Map(all_achievements().map(x => [x.id, assess_achievement(x)]));
	current.assessment.leaderboards = new Map(all_leaderboards().map(x => [x.id, assess_leaderboard(x)]));
	current.assessment.notes = assess_code_notes(current.notes);
	current.assessment.rp = assess_rich_presence(current.rp);

	current.assessment.set = assess_set();
}

function load_achievement_set(json)
{
	current.set = AchievementSet.fromJSON(json);
	if (json.RichPresencePatch)
		load_rich_presence(json.RichPresencePatch, false);
	update_assessment();
	rebuild_sidebar();
}

function load_user_file(txt)
{
	current.local = AchievementSet.fromLocal(txt);
	current.local.id = current.id;
	update_assessment();
	rebuild_sidebar();
}

function load_code_notes(json)
{
	current.notes = [];
	for (const obj of json) if (obj.Note)
		current.notes.push(new CodeNote(obj.Address, obj.Note, obj.User));
	update_assessment();
	rebuild_sidebar();
}

function load_rich_presence(txt, from_file)
{
	if (!current.rp || from_file)
		current.rp = RichPresence.fromText(txt);
	update_assessment();
	rebuild_sidebar();
}

function rebuild_sidebar()
{
	let header;
	assetList = [];
	let post_load = null;

	if (current.set != null || current.local != null)
	{
		let row = add_asset_row(current.assessment.set.pass() ? 'info' : 'fail', "🔍 Set Overview");
		row.onclick = function(){ show_set_overview(row); };
		if (!post_load) post_load = row.onclick;
		assetList.push(row);
	}

	if (current.notes.length > 0)
	{
		let row = add_asset_row(current.assessment.notes.pass() ? 'info' : 'fail', "📝 Code Notes");
		row.onclick = function(){ show_code_notes(row); };
		if (!post_load) post_load = row.onclick;
		assetList.push(row);
	}

	if (current.rp)
	{
		let row = add_asset_row(current.assessment.rp.pass() ? 'info' : 'fail', "🎮 Rich Presence");
		row.onclick = function(){ show_rich_presence(row); };
		if (!post_load) post_load = row.onclick;
		assetList.push(row);
	}
	
	if (current.set != null || current.local != null)
	{
		header = document.createElement('tr');
		header.classList.add("asset-header");
		header.appendChild(document.createElement('td')).appendChild(document.createTextNode("Achievements"));
		assetList.push(header);

		for (const ach of all_achievements().sort((a, b) => a.state.rank - b.state.rank))
		{
			let feedback = current.assessment.achievements.get(ach.id);
			let tr = add_asset_row(feedback.pass() ? 'pass' : 'fail', `🏆 ${ach.state.marker}${ach.title} (${ach.points})`);
			tr.onclick = function(){ show_achievement(ach, tr); };
			assetList.push(tr);

			// preload image
			let img = new Image();
			img.src = ach.badge;
		}

		header = document.createElement('tr');
		header.classList.add("asset-header");
		header.appendChild(document.createElement('td')).appendChild(document.createTextNode("Leaderboards"));
		assetList.push(header);

		for (const lb of all_leaderboards().sort((a, b) => a.state.rank - b.state.rank))
		{
			let feedback = current.assessment.leaderboards.get(lb.id);
			let tr = add_asset_row(feedback.pass() ? 'pass' : 'fail', `📊 ${lb.state.marker}${lb.title}`);
			tr.onclick = function(){ show_leaderboard(lb, tr); };
			assetList.push(tr);
		}
	}

	document.getElementById('list-body').replaceChildren(...assetList);
	if (document.querySelectorAll('.list-body .selected').length == 0 && post_load) post_load();
}