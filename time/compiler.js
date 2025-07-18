let precedes = function(t1, step1, t2, step2) {
    if (t1 < t2) {
        return true;
    } else if (t1 === t2 && step1 > step2) {
        return true;
    } else {
        return false;
    }
}


class Mem {
    constructor(inputs) {
        this.memory = {};
        this.reads = [];

        for (let inp of inputs) {
            let val = inp.val;
            let addr = inp.addr;
            let time = inp.t;
            let step = inp.step;
            if (time === undefined) {
                time = -Infinity;
            }
            if (step === undefined) {
                step = -1;
            }
            this.set(val, addr, time, step);
        }
    }

    get(addr, time, step) {
        let  val = 0;
        let t = -Infinity;
        let cur_step = -1;
        if (this.memory[addr] !== undefined) {
            let i = 0;
            while (i < this.memory[addr].length && precedes(this.memory[addr][i].t, this.memory[addr][i].step, time, step)) {
                val = this.memory[addr][i].val;
                t = this.memory[addr][i].t;
                cur_step = this.memory[addr][i].step;
                i++;
            }
        }

        return {val:val, time:t, step:cur_step};
    }

    set(val, addr, time, step) {
        if (this.memory[addr] === undefined) {
            this.memory[addr] = [{t:time, val:val, step:step}];
        } else {
            let i = 0;
            while (i < this.memory[addr].length && precedes(this.memory[addr][i].t, this.memory[addr][i].step, time, step)) {
                i++;
            }
            this.memory[addr].splice(i, 0, {t:time, val:val, step:step});
        }
    }
}



class Compiler {
    constructor(commands, input) {
        this.PARAMS = {
            'read': true,
            'write': false,
            'add': true,
            'sub': true,
            'time': true,
            'pos': true,

        }

        this.commands = commands;
        this.input = input;

        this.memory = new Mem(input);
        this.temp = new Mem([]);

        this.reads = [];
        this.writes = [];

        this.step = 0;
        this.addr = 0;
        this.val = 0;
        this.t = 0;

        this.prev_timeline = {};
        this.timeline = {};
        this.times = [];

        this.result = undefined;

        this.done = false;
    }

    set_up() {
        this.step = 0;
        this.addr = 0;
        this.val = 0;
        this.t = 0;

        this.memory = new Mem(this.input);

        let temp = [];
        for (let w of this.writes) {
            temp.push({val:w.val, addr:w.addr, t:w.t, step:w.step});
        }
        this.temp = new Mem(temp);

        this.reads = [];
        this.writes = [];
        this.prev_timeline = this.timeline;
        this.timeline = {};
        this.times = [];

        this.result = undefined;
        this.done = false;
    }

    get() {
        let mem = this.memory.get(this.addr, this.t, this.step);
        let temp = this.temp.get(this.addr, this.t, this.step);
        let val = 0;
        if (precedes(mem.time, mem.step, temp.time, temp.step)) {
            val = temp.val;            
        }   else {
            val = mem.val;
        }

        this.reads.push({val:val, addr:this.addr, time:this.t, step:this.step});
        return val;
    }

    add_to_timeline(time, addr, val, step) {
        if (this.timeline[time] === undefined) {
            this.timeline[time] = [{addr:addr, val:val, step:step}];
        } else {
            this.timeline[time].push({addr:addr, val:val, step:step});
        }
    }

    advance() {
        if (this.step < this.commands.length) {
            this.add_to_timeline(this.t, this.addr, this.val, this.step);
            this.times.push(this.t);
            if (this.commands[this.step].val !== undefined) {
                this[this.commands[this.step].name](this.commands[this.step].val);
            } else if (this.PARAMS[this.commands[this.step].name]) {
                this[this.commands[this.step].name](this.get());
            } else {
                this[this.commands[this.step].name]();
            }
            this.t++;
            this.step++;
        }
    }

    solve() {
        while (this.step < this.commands.length) {
            this.advance();
        }
    }

    get_visible_pointers() {
        let splits = [];
        for (let r of this.reads) {
            let val = this.memory.get(r.addr, r.time, r.step).val;
            if (val !== r.val) {
                splits.push(r.step);
            }
        }
        if (splits.length === 0) {
            this.done = true;
        }
        splits.push(this.commands.length);

        let preparations = [];
        for (let t in this.timeline) {
            t = parseInt(t);
            if (t < 0) {
                let i = 0;
                while (i < this.timeline[t].length && this.timeline[t][i].step <= splits[0]) {
                    if (this.commands[this.timeline[t][i].step].name === "write") {
                        preparations.push({time:t, addr:this.timeline[t][i].addr, val:this.timeline[t][i].val, step:this.timeline[t][i].step})
                    }
                    i++;
                }
            }
        }
        for (let t in this.prev_timeline) {
            t = parseInt(t);
            if (t < 0) {
                let i = this.prev_timeline[t].length - 1;
                while (i >= 0 && this.prev_timeline[t][i].step > splits[0]) {
                    if (this.commands[this.prev_timeline[t][i].step].name === "write") {
                        preparations.push({time:t, addr:this.prev_timeline[t][i].addr, val:this.prev_timeline[t][i].val, step:this.prev_timeline[t][i].step});
                    }
                    i--;
                }
            }
        }
        preparations.sort(function(a, b) {
            if (precedes(a.t, a.step, b.t, b.step)) {
                return -1;
            } else {
                return 1;
            }
        })

        let result = [];
        let phase = 0;
        for (let step = 0; step < this.commands.length; step++) {
            if (step > splits[phase]) {
                phase++;
            }
            let pointers = [];
            let i = 0;
            let cur_timeline = [];
            let prev_timeline = [];
            let time = this.times[step];
            if (this.timeline[time] !== undefined) {
                cur_timeline = this.timeline[time];
            }
            if (this.prev_timeline[time] !== undefined) {
                prev_timeline = this.prev_timeline[time];
            }
            if (this.commands[step].name === "time") {
                while (i < cur_timeline.length && cur_timeline[i].step < step) {
                    i++;
                }
            }
            while (i < cur_timeline.length && cur_timeline[i].step <= splits[phase]) {
                if (cur_timeline[i].step === step || this.commands[cur_timeline[i].step].name === "write") {
                    pointers.push({time:time, addr:cur_timeline[i].addr, val:cur_timeline[i].val, step:cur_timeline[i].step});
                }
                i++;
            }
            let start_pt = pointers.length;
            let j = prev_timeline.length - 1;
            while (j >= 0 && prev_timeline[j].step > splits[phase]) {
                if (prev_timeline[i].step === step || this.commands[prev_timeline[i].step].name === "write") {
                    pointers.splice(start_pt, 0, {time:time, addr:prev_timeline[j].addr, val:prev_timeline[j].val, step:prev_timeline[j].step});
                }
                j--;
            }

            pointers.reverse();
            if (step === 0) {
                pointers = preparations.concat(pointers);
            }

            result.push(pointers);
        }
        
        return result;
    }

    read(param) {
        this.val = param;
    }

    write() {
        this.memory.set(this.val, this.addr, this.t, this.step);
        this.writes.push({val:this.val, addr:this.addr, t:this.t, step:this.step});
    }

    add(param) {
        this.val += param;
    }

    sub(param) {
        this.val -= param;
    }

    pos(param) {
        this.addr = param;
    }

    time(param) {
        this.t = param - 1;
    }

    out(param) {
        if (param === undefined) {
            this.result = {delayed: true, addr: this.addr, t: this.t};
        } else {
            this.result = {delayed: false, val: param};
        }
    }
}