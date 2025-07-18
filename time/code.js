let canvas = document.getElementById("canvas");
let canvas_width = 1920;
let min_canvas_width = 1920;
let canvas_height = 945;
let scale = 1;
let ctx = canvas.getContext("2d", {willReadFrequently: true});

let other_canvas = document.getElementById("invisible");
let other_ctx = other_canvas.getContext("2d");

let draw_curved_rect = function(left, top, width, height, rtl, rtr, rbr, rbl) {
    ctx.beginPath();
    if (rtl === 0) {
        ctx.moveTo(left, top);
    } else {
        ctx.arc(left + rtl, top + rtl, rtl, Math.PI, Math.PI*3/2);
    }

    if (rtr === undefined) {
        rtr = rtl;
    }
    if (rtr === 0) {
        ctx.lineTo(left + width, top);
    } else {
        ctx.arc(left + width - rtr, top + rtr, rtr, Math.PI*3/2, Math.PI*2);
    }

    if (rbr === undefined) {
        rbr = rtr;
    }
    if (rbr === 0) {
        ctx.lineTo(left + width, top + height);
    } else {
        ctx.arc(left + width - rbr, top + height - rbr, rbr, 0, Math.PI/2);
    }

    if (rbl === undefined) {
        rbl = rbr;
    }
    if (rbl === 0) {
        ctx.lineTo(left, top + height);
    } else {
        ctx.arc(left + rbl, top + height - rbl, rbl, Math.PI/2, Math.PI);
    }
    ctx.closePath();
}

let smooth_step = function(t) {
    return 3*t*t - 2*t*t*t;
}


class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.prev_x = x;
        this.prev_y = y;
    }

    move(efficiency) {
        const vx = (this.x - this.prev_x) * efficiency;
        const vy = (this.y - this.prev_y) * efficiency;
        this.prev_x = this.x;
        this.prev_y = this.y;
        this.x += vx;
        this.y += vy;
    }

    gravity(strength) {
        this.y += strength;
    }
}

class Link {
    constructor(p1, p2, length) {
        this.p1 = p1;
        this.p2 = p2;
        if (length === undefined) {
            const dx = this.p2.x - this.p1.x;
            const dy = this.p2.y - this.p1.y;
            this.length = Math.sqrt(dx*dx + dy*dy);
        } else {
            this.length = length;
        }
    }

    constrain(ratio) {
        if (ratio === undefined) {
            ratio = 0.5;
        }

        const dx = this.p2.x - this.p1.x;
        const dy = this.p2.y - this.p1.y;
        const length = Math.sqrt(dx*dx + dy*dy);
        const desired = this.length;
        this.p1.x -= dx * (desired / length - 1)*(1-ratio);
        this.p1.y -= dy * (desired / length - 1)*(1-ratio);
        this.p2.x += dx * (desired / length - 1)*ratio;
        this.p2.y += dy * (desired / length - 1)*ratio;
    }
}


class Parameter {
    constructor(size, radius) {
        this.value = null;
        this.display = null;
        this.size = size;
        this.radius = radius;
        this.t = 0;
        this.duration = 6;
        this.m_over = false;
        this.drag_start = null;
        this.speed = 0;
        this.click_counter = 0;
    }

    draw() {
        ctx.save();
        ctx.fillStyle = "#FFFFFF";
        ctx.globalAlpha = 0.7;
        const t = smooth_step(this.t / this.duration)
        draw_curved_rect(-this.size/2 - t*2, -this.size/2 - t*2, this.size + t*4, this.size + t*4, this.radius);

        this.width - this.height/2
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();

        ctx.globalAlpha = t;
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#000000"
        ctx.moveTo(-6, -this.size/2 + 20 - 17*t - Math.max(0,this.speed)*30);
        ctx.lineTo(0, -this.size/2 + 14 - 17*t - Math.max(0,this.speed)*30);
        ctx.lineTo(6, -this.size/2 + 20 - 17*t - Math.max(0,this.speed)*30);
        ctx.stroke();

        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#000000";
        ctx.moveTo(-6, this.size/2 - 20 + 17*t - Math.min(0,this.speed)*30);
        ctx.lineTo(0, this.size/2 - 14 + 17*t - Math.min(0,this.speed)*30);
        ctx.lineTo(6, this.size/2 - 20 + 17*t - Math.min(0,this.speed)*30);
        ctx.stroke();
        if (this.display !== null) {
            ctx.globalAlpha = 1;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#000000";
            const size = this.size*2/3
            if (Math.floor(this.display) === Math.ceil(this.display)) {
                ctx.font = size + "px Lexend";
                ctx.fillText(Math.floor(this.display) +"", 0, 0);
            } else {
                const low = this.display - Math.floor(this.display);
                const high = Math.ceil(this.display) - this.display;
                
                ctx.globalAlpha = 1-low;
                ctx.font = size/3 + size*2/3*(1-low) + "px Lexend";
                ctx.fillText(Math.floor(this.display)+"", 0, this.size*2/5*low);

                ctx.globalAlpha = 1-high;
                ctx.font = size/3 + size*2/3*(1-high) + "px Lexend";
                ctx.fillText(Math.ceil(this.display)+"", 0, -this.size*2/5*high);
            }
        }
        ctx.restore();
    }

    update(mx, my, click) {
        if (this.drag_start !== null) {
            const max_dist = 4;
            let dy = my - this.drag_start;
            dy = Math.max(Math.min(dy, max_dist), -max_dist);
            this.speed = -dy*Math.abs(dy)*0.02
            this.display += this.speed;
            this.click_counter -= 1;

            if (click === -1) {
                mouse.unclaim(this);
                this.drag_start = null;
                this.speed = 0;
                if (this.click_counter > 0) {
                    this.display = null;
                    this.value = null;
                    this.click_counter = 0;
                } else {
                    if (this.display - Math.floor(this.display) < 0.5) {
                        this.value = Math.floor(this.display);
                    } else {
                        this.value = Math.ceil(this.display);
                    }
                }
            }
        } else {
            if (this.display !== this.value) {
                const diff = this.value - this.display;
                if (Math.abs(diff) < 0.01) {
                    this.display = this.value;
                } else {
                    this.display += diff*0.2;
                }
            }
        }

        if (mouse.check(this) && mx >= -1 && mx <= 1 && my >= -1 && my <= 1) {
            this.m_over = true;
            if (click === 2) {
                mouse.claim(this);
                this.drag_start = my;
                if (this.value !== null) {
                    this.click_counter = 10;
                } else {
                    this.display = 0;
                }
            }
        } else if (this.drag_start === null) {
            this.m_over = false;
        }

        if (this.m_over) {
            if (this.t < this.duration) {
                this.t += 1;
            }
        } else {
            if (this.t > 0) {
                this.t -= 1;
            }
        }

        return this.m_over;
    } 
}


class Command {
    constructor(text, parameter, colour, width, x, val) {
        this.text = text;
        this.parameter = parameter;
        this.colour = colour;
        this.width = width;
        this.height = width / 4;
        this.spacing = this.height / 10;
        this.radius = this.height / 4;
        this.x = x;
        if (this.parameter) {
            this.box = new Parameter(this.height - this.spacing*2, this.radius);
            this.param_x = this.width - this.height/2 - 2*this.spacing

            if (val !== undefined) {
                this.box.value = val;
                this.box.display = val;
            }
        }

        this.grip = 0;
        this.drag = 0;
        this.rope_top = -5;

        this.done = false;
        
        const string_length = 0.07;
        const start_y = -this.height*this.height/4*string_length - this.width*2;
        let key_hole_y = start_y + this.width + this.height/2 - 2*this.spacing;
        let key_tip_y = key_hole_y + this.height * Math.sqrt(3)/4 + this.height;

        this.rope = []
        const n = 10;
        for (let i = 0; i < n*2; i++) {
            const x = this.x-this.height/2 + this.height * i / (n*2-1);
            const y = (x - this.x + this.height/2) * (x - this.x - this.height/2)*string_length - this.width*2;
            this.rope.push(new Particle(x,y));
        }

        this.particles = [new Particle(this.x, start_y), new Particle(this.x, key_hole_y), new Particle(this.x, key_tip_y)];
        this.particle_links = [];
        for (let i = 1; i < this.particles.length; i++) {
            this.particle_links.push(new Link(this.particles[i-1], this.particles[i]));
        }
        this.rope_links = [];
        this.rope_links.push(new Link(this.particles[0], this.rope[n-1]));
        for (let i = n-1; i >= 1; i--) {
            this.rope_links.push(new Link(this.rope[i], this.rope[i-1]));
        }
        
        this.rope_links.push(new Link(this.particles[0], this.rope[n]));
        for (let i = n; i < n*2-1; i++) {
            this.rope_links.push(new Link(this.rope[i], this.rope[i+1]));
        }

        this.key_points = [this.height/7, this.height/4, this.height/7, this.height/4];

        this.move_time = 0;
        this.move_duration = 15;
        this.from = [];
        this.to = [];

        this.turning = -1;
        this.angle = 0;
        this.rotate_time = 0;
        this.rotate_duration = 15;
    }

    draw_key() {
        ctx.save();
        ctx.translate(this.height/4, 0);
        ctx.scale(1, Math.cos(this.angle));
        ctx.transform(1, 0, -Math.sin(this.angle)/2, 1, 0, 0);
        ctx.beginPath();
        ctx.arc(0, 0, this.height/2, Math.PI/6, 2*Math.PI - Math.PI/6);
        ctx.quadraticCurveTo(Math.sqrt(3)/2*this.height/2 + this.height/8, -this.height/4 - this.height/8, Math.sqrt(3)/2*this.height/2 + this.height/8, -this.height/4)
        ctx.lineTo(Math.sqrt(3)/2*this.height/2 + this.height*3/4, -this.height/4);
        ctx.quadraticCurveTo(Math.sqrt(3)/2*this.height/2 + this.height, -this.height/10, Math.sqrt(3)/2*this.height/2 + this.height*7/10, this.height/4);
        let start_x = Math.sqrt(3)/2*this.height/2 + this.height*7/10;
        let end_x = Math.sqrt(3)/2*this.height/2 + this.height/8;
        for (let i = 1; i < this.key_points.length+1; i++) {
            let t = i / (this.key_points.length+1);
            let x = start_x * (1-t) + end_x * t;
            let y = this.key_points[i-1];
            ctx.lineTo(x, y);
        }
        ctx.lineTo(end_x, this.height/4);
        ctx.quadraticCurveTo(Math.sqrt(3)/2*this.height/2 + this.height/8, this.height/4 + this.height/8, Math.sqrt(3)/2*this.height/2, this.height/4);


        ctx.moveTo(-this.height/4 + 5, 0);
        ctx.arc(-this.height/4, 0, 5, 0, 2*Math.PI, true);
        ctx.fillStyle = "rgb(245,204,137)";
        ctx.fill();
        ctx.lineCap = "round";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(Math.sqrt(3)/2*this.height/2 + this.height/25, -this.height/10);
        ctx.lineTo(Math.sqrt(3)/2*this.height/2 + this.height*4/5, -this.height/10);
        ctx.strokeStyle = "rgb(225, 184, 117)";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
    }

    draw_command() {
        ctx.fillStyle = 'hsl('+this.colour+', 80%, 80%)';
        draw_curved_rect(-this.spacing, -this.height/2, this.width/2, this.height, this.radius, 0, 0, this.radius);
        ctx.arc(0, 0, 5, 0, 2*Math.PI, true);
        ctx.fill();
        draw_curved_rect(this.width/2-this.spacing, -this.height/2, this.width/2, this.height, 0, this.radius, this.radius, 0);
        ctx.arc(this.width - 2*this.spacing, 0, 5, 0, 2*Math.PI, true);
        ctx.fill();

        draw_curved_rect(-this.spacing, -this.height/2, this.width, this.height, this.radius);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.width - 2*this.spacing, 0, 5, 0, 2*Math.PI, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, 2*Math.PI, true);
        ctx.stroke();
        if (this.parameter) {
            ctx.save();
            ctx.translate(this.param_x, 0);
            this.box.draw();
            ctx.restore();
        }

        ctx.font = (this.height - 2*this.spacing) + "px Lexend";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000000";
        ctx.fillText(this.text, this.radius - this.spacing, 0);
    }

    draw() {
        ctx.lineCap = "round";
        if (this.rope_links.length > 0) {
            ctx.beginPath();
            ctx.moveTo(this.rope_links[this.rope_links.length/2].p1.x, this.rope_links[this.rope_links.length/2].p1.y);
            for (let i = this.rope_links.length/2; i < this.rope_links.length; i++) {
                ctx.lineTo(this.rope_links[i].p2.x, this.rope_links[i].p2.y);
            }
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.strokeStyle = "#A0B0B0";
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        const theta1 = Math.atan2(this.particles[1].y - this.particles[0].y, this.particles[1].x - this.particles[0].x);
        const theta2 = Math.atan2(this.particles[2].y - this.particles[1].y, this.particles[2].x - this.particles[1].x);
        ctx.save();
        ctx.translate(this.particles[0].x, this.particles[0].y);
        ctx.rotate(theta1);
        ctx.beginPath();
        ctx.moveTo(this.width - 2*this.spacing, 0);
        ctx.bezierCurveTo(this.width - 2*this.spacing, -10, this.particle_links[0].length, -10, this.particle_links[0].length, 0);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = "#A0B0B0";
        ctx.lineWidth = 3;
        ctx.stroke();

        this.draw_command();
        ctx.restore();

        ctx.save();
        ctx.translate(this.particles[1].x, this.particles[1].y);
        ctx.rotate(theta2);
        this.draw_key();
        ctx.restore();

        ctx.save();
        ctx.translate(this.particles[0].x, this.particles[0].y);
        ctx.rotate(theta1);
        ctx.beginPath();
        ctx.moveTo(this.width - 2*this.spacing, 0);
        ctx.bezierCurveTo(this.width - 2*this.spacing, 10, this.particle_links[0].length, 10, this.particle_links[0].length, 0);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = "#A0B0B0";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        if (this.rope_links.length > 0) {
            ctx.beginPath();
            ctx.moveTo(this.rope_links[0].p1.x, this.rope_links[0].p1.y);
            for (let i = 0; i < this.rope_links.length/2; i++) {
                ctx.lineTo(this.rope_links[i].p2.x, this.rope_links[i].p2.y);
            }
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.strokeStyle = "#A0B0B0";
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    drag_particle(i, t) {
        const x = this.particles[i].x * (1 - t) + this.particles[i+1].x * t;
        const y = this.particles[i].y * (1 - t) + this.particles[i+1].y * t;
        const dx1 = mouse.x - t * this.particle_links[i].length - this.particles[i].x;
        const dx2 = mouse.x + (1-t) * this.particle_links[i].length - this.particles[i+1].x;
        const dy1 = mouse.y - this.particles[i].y;
        const dy2 = mouse.y - this.particles[i+1].y;
        this.particles[i].x += dx1 * 0.1;
        this.particles[i].y += dy1 * 0.1;
        this.particles[i+1].x += dx2 * 0.1;
        this.particles[i+1].y += dy2 * 0.1;
    }

    goto(x, y) {
        this.move_time = 0;
        this.from = [];
        this.to = [];
        this.from = [{x:this.particles[0].x, y:this.particles[0].y}, {x:this.particles[1].x, y:this.particles[1].y}, {x:this.particles[2].x, y:this.particles[2].y}]
        this.to = [{x:x, y:y}, {x:x + this.particle_links[0].length, y:y}, {x:x + this.particle_links[0].length + this.particle_links[1].length, y:y}]
        let d = 0;
        for (let i = 0; i < this.particles.length; i++) {
            this.from.push({x:this.particles[i].x, y:this.particles[i].y});
            this.to.push({x:x + d, y:y});
            if (i < this.particle_links.length) {
                d += this.particle_links[i].length;
            }
        }
        if (this.drag < 3) {
            this.drag = 3;
        }
    }

    jump_to(x, y) {
        this.particles[0].x = x;
        this.particles[0].y = y;
        x += this.particle_links[0].length;
        this.particles[1].x = x;
        this.particles[1].y = y;
        x += this.particle_links[1].length;
        this.particles[2].x = x;
        this.particles[2].y = y;
    }

    shift(amount) {
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].y += amount;
            this.particles[i].prev_y += amount;
        }
        for (let i = 0; i < this.from.length; i++) {
            this.from[i].y += amount;
        }
        for (let i = 0; i < this.to.length; i++) {
            this.to[i].y += amount;
        }
    }

    turn(keyhole) {
        if (this.turning === 0) {
            this.keyhole = keyhole;
            this.turning++;
            this.goto(this.particles[0].x + 100, this.particles[0].y);
        }
    }

    make_ghostly() {
        this.drag = 3;
        this.turning = 0;
        this.move_time = this.move_duration;
        this.rope = [];
        this.rope_links = [];
    }

    get_centre() {
        const x = (this.particles[0].x + this.particles[1].x)/2;
        const y = (this.particles[0].y + this.particles[1].y)/2;

        const left = this.particles[0].x - this.spacing;
        const top = this.particles[0].y - this.height/2;
        const right = this.particles[2].x;
        const bottom = this.particles[0].y + this.height/2;
        return {x:x, y:y, left:left, top:top, right:right, bottom:bottom};
    }

    update_ghostly() {
        this.update_placed();
        if (!this.ghostly_turned) {
            if (this.ghostly_t < this.ghostly_duration) {
                this.ghostly_t++;
            }
            if (this.turning === 4) {
                this.ghostly_turned = true;
            }
        } else {
            if (this.ghostly_t > 0) {
                this.ghostly_t--;
            } else {
                this.done = true;
            }
        }
    }

    update_placed(editable) {
        if (this.move_time < this.move_duration) {
            this.move_time++;
            for (let i = 0; i < this.particles.length; i++) {
                const t = smooth_step(this.move_time / this.move_duration);
                this.particles[i].x = this.from[i].x * (1-t) + this.to[i].x * t;
                this.particles[i].y = this.from[i].y * (1-t) + this.to[i].y * t;
                this.particles[i].prev_x = this.particles[i].x;
                this.particles[i].prev_y = this.particles[i].y;
            }
        } else if (this.turning < 0) {
            this.turning = 0;
        }

        if (this.turning > 0) {
            if (this.turning === 1 && this.move_time >= this.move_duration) {
                this.turning++;
            } else if (this.turning === 2) {
                this.rotate_time++;
                this.angle = smooth_step(this.rotate_time / this.rotate_duration) * Math.PI/3;
                this.keyhole.angle = this.angle;
                if (this.rotate_time >= this.rotate_duration) {
                    this.turning++;
                }
            } else if (this.turning === 3) {
                this.rotate_time--;
                this.angle = smooth_step(this.rotate_time / this.rotate_duration) * Math.PI/3;
                this.keyhole.angle = this.angle;
                if (this.rotate_time <= 0) {
                    this.turning++;
                    this.goto(this.particles[0].x - 100, this.particles[0].y);
                }
            } else if (this.turning === 4 && this.move_time >= this.move_duration) {
                this.turning = 0;
            }
        }

        if (editable) {
            this.dangle_collision(0, false);
        }
    }

    update_rope_released() {
        if (this.rope_top < -canvas_height/2) {
            this.rope_links = [];
            this.rope = [];
        } else {
            for (let i = 0; i < this.rope.length; i++) {
                this.rope[i].move(0.95);
                this.rope[i].gravity(3);
            }
            this.rope_top -= 10;
        }
        for (let _ = 0; _ < 1; _++) {
            if (this.rope.length > 0) {
                for (let i = this.rope_links.length-1; i >= 0; i--) {
                    this.rope_links[i].constrain();
                }
                this.rope[0].x = this.x-this.height/2;
                this.rope[0].y = this.rope_top;
                this.rope[this.rope.length-1].x = this.x+this.height/2;
                this.rope[this.rope.length-1].y = this.rope_top;
            }
        }
    }

    update_released() {
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].move(0.95);
            this.particles[i].gravity(5);
        }

        for (let _ = 0; _ < 1; _++) {
            for (let i = this.particle_links.length-1; i >= 0; i--) {
                this.particle_links[i].constrain();
            }
        }

        if (this.particles[0].y > canvas_height + this.height/2 && this.particles[1].y > canvas_height + this.height/2 && this.particles[2].y > canvas_height + this.height/2) {
            this.done = true;
        }
    }

    update_drag() {
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].move(0.85);
        }
        this.particles[2].gravity(5);
        this.drag_particle(0,this.grip);
        
        if (this.rope_top < -canvas_height/2) {
            this.rope_links = [];
            this.rope = [];
        } else {
            for (let i = 0; i < this.rope.length; i++) {
                this.rope[i].move(0.95);
                this.rope[i].gravity(5);
            }
            this.rope_top -= 10;
        }

        for (let _ = 0; _ < 1; _++) {
            if (this.rope.length > 0) {
                for (let i = this.rope_links.length-1; i >= 0; i--) {
                    this.rope_links[i].constrain();
                }
                this.rope[0].x = this.x-this.height/2;
                this.rope[0].y = this.rope_top;
                this.rope[this.rope.length-1].x = this.x+this.height/2;
                this.rope[this.rope.length-1].y = this.rope_top;
            }
            for (let i = this.particle_links.length-1; i >= 0; i--) {
                this.particle_links[i].constrain();
            }
        }

        if (mouse.click === -1) {
            this.drag = 2;
            mouse.unclaim(this);
        }
    }

    dangle_collision(i, dangling) {
        const shiftxf = mouse.x - this.particles[i].x;
        const shiftyf = mouse.y - this.particles[i].y;
        const shiftxi = mouse.prev_x - this.particles[i].x;
        const shiftyi = mouse.prev_y - this.particles[i].y;

        const dx = this.particles[i+1].x - this.particles[i].x;
        const dy = this.particles[i+1].y - this.particles[i].y;
        const dx2 = -dy * this.height/2 / this.particle_links[i].length;
        const dy2 = dx * this.height/2  /this.particle_links[i].length;

        const det = dx * dy2 - dx2 * dy;
        const inv_a = dy2 / det;
        const inv_b = -dx2 / det;
        const inv_c = -dy / det;
        const inv_d = dx / det;

        const xi = shiftxi * inv_a + shiftyi * inv_b;
        const yi = shiftxi * inv_c + shiftyi * inv_d;
        const xf = shiftxf * inv_a + shiftyf * inv_b;
        const yf = shiftxf * inv_c + shiftyf * inv_d;

        if (i === 0 && this.parameter) {
            const start_x = this.param_x - (this.height/2 - this.spacing + 2);
            const end_x   = this.param_x + (this.height/2 - this.spacing + 2);
            const param_x = (xf - (this.param_x - this.spacing) / this.particle_links[0].length) / ((this.height/2 - this.spacing + 2) / this.particle_links[0].length);
            const param_y = yf * this.height / (this.height - 2*this.spacing + 4);
            this.box.update(param_x, param_y, mouse.click);
        }

        if (mouse.check(this) && xf >= 0 && xf <= 1) {
            if (i === 0 && yf >= -1 && yf <= 1 && mouse.click === 2 && this.turning <= 0) {
                this.move_time = 0;
                this.drag = 1;
                this.grip = xf;
                this.rope_links.splice(0,1);
                this.rope_links.splice(this.rope_links.length/2, 1);
                this.turning = -1;
                mouse.claim(this);
            }

            if (dangling && ((yi < -1 && yf >= -1) || (yi > 1 && yf <= 1))) {
                const force = (yf - yi) * 10;
                const ratio = xf;
                this.particles[i].x += force * (1 - ratio) * dx2 / (this.height/2);
                this.particles[i].y += force * (1 - ratio) * dy2 / (this.height/2);
                this.particles[i+1].x += force * ratio * dx2 / (this.height/2);
                this.particles[i+1].y += force * ratio * dy2 / (this.height/2);
            }
        }
    }

    update_non_drag() {
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].move(0.9);
            this.particles[i].gravity(5);
        }
        for (let i = 0; i < this.rope.length; i++) {
            this.rope[i].move(0.85);
            this.rope[i].gravity(5);
        }

        this.dangle_collision(0, true);
        this.dangle_collision(1, true);
        
        for (let _ = 0; _ < 2; _++) {
            for (let i = 0; i < this.rope_links.length; i++) {
                this.rope_links[i].constrain();
            }
            for (let i = this.particle_links.length-1; i >= 0; i--) {
                this.particle_links[i].constrain();
            }
            this.rope[0].x = this.x-this.height/2;
            this.rope[0].y = this.rope_top;
            this.rope[this.rope.length-1].x = this.x+this.height/2;
            this.rope[this.rope.length-1].y = this.rope_top;
        }      
    }

    update(time, click, editable) {
        if (this.drag === 0) {
            this.update_non_drag(click);
        } else if (this.drag === 1) {
            this.update_drag(click);
        } else if (this.drag === 2) {
            this.update_released();
            this.update_rope_released();
        } else if (this.drag === 3) {
            this.update_placed(editable);
            this.update_rope_released();
        } else if (this.drag === 4) {
            this.update_ghostly();
        }
    }
}


class Ghostliness {
    constructor() {
        this.amplitude = 4;
        this.wavelength = 120;
        this.slowness = 1;
        this.fade = 0.75;

        this.t = 0;
        this.objects = [];
        this.bounds = {left:Infinity, right:-Infinity, top:Infinity, bottom:-Infinity};
        this.img = undefined;
    }

    add_object(draw, x, y, strength, left, top, right, bottom) {
        x = Math.max(1, Math.min(canvas_width-1, x)) * scale;
        y = Math.max(1, Math.min(canvas_height-1, y)) * scale;
        
        this.objects.push({
            draw: draw,
            x: Math.floor(x),
            y: Math.floor(y),
            strength: strength
        });

        if (left < this.bounds.left) {
            this.bounds.left = Math.max(0, Math.floor(left * scale));
        }
        if (right > this.bounds.right) {
            this.bounds.right = Math.min(canvas.width, Math.ceil(right * scale));
        }
        if (top < this.bounds.top) {
            this.bounds.top = Math.max(0, Math.floor(top * scale));
        }
        if (bottom > this.bounds.bottom) {
            this.bounds.bottom = Math.min(canvas.height, Math.ceil(bottom * scale));
        }
    }

    update() {
        this.t = (this.t + 1) % (this.wavelength * this.slowness);
        this.objects = [];
        this.bounds = {left:Infinity, right:-Infinity, top:Infinity, bottom:-Infinity};
    }

    calculate() {
        for (let o of this.objects) {
            o.draw();
        }
        const orig = ctx.getImageData(this.bounds.left, this.bounds.top, this.bounds.right - this.bounds.left, this.bounds.bottom - this.bounds.top);

        const ghostly = ctx.createImageData(this.bounds.right - this.bounds.left, this.bounds.bottom - this.bounds.top + Math.floor(2*this.amplitude*scale));
        let found = {};
        for (let o of this.objects) {
            const queue = [{x:o.x, y:o.y}];
            while (queue.length > 0) {
                const next = queue.pop();
                const img = orig;
                const i = (next.y - this.bounds.top) * (this.bounds.right - this.bounds.left) + (next.x - this.bounds.left);

                if (found[i] === undefined) {
                    found[i] = true;
                    
                    const alpha = img.data[i*4 + 3];
                    if (alpha > 0) {
                        const t1 = Math.min(o.strength, 1);
                        const t2 = Math.max(o.strength - 1, 0);

                        const amp = this.amplitude * (1 - t2);
                        const new_y = next.y - (o.strength * amp * Math.sin((next.x + this.t / this.slowness) / this.wavelength * 2*Math.PI)) * scale;
                        const above_y = Math.floor(new_y);
                        const below_y = Math.ceil(new_y);
                        const ratio = new_y - above_y;
                        
                        const above_i = ((next.x - this.bounds.left) + (above_y - this.bounds.top + Math.floor(this.amplitude * scale)) * (this.bounds.right - this.bounds.left)) * 4;
                        const below_i = ((next.x - this.bounds.left) + (below_y - this.bounds.top + Math.floor(this.amplitude * scale)) * (this.bounds.right - this.bounds.left)) * 4;

                        ghostly.data[above_i] += (this.fade + (1 - this.fade) * t2) * img.data[i*4] * (1 - ratio);
                        ghostly.data[above_i + 1] += img.data[i*4 + 1] * (1 - ratio);
                        ghostly.data[above_i + 2] += img.data[i*4 + 2] * (1 - ratio);
                        ghostly.data[above_i + 3] += Math.floor(img.data[i*4 + 3] * (1 - ratio) * (t1 * 0.8 + t2 * 0.2));

                        ghostly.data[below_i] += (this.fade + (1 - this.fade) * t2) * img.data[i*4] * ratio;
                        ghostly.data[below_i + 1] += img.data[i*4 + 1] * ratio;
                        ghostly.data[below_i + 2] += img.data[i*4 + 2] * ratio;
                        ghostly.data[below_i + 3] += img.data[i*4 + 3] * ratio * (t1 * 0.8 + t2 * 0.2);

                        queue.push({x:next.x - 1, y:next.y});
                        queue.push({x:next.x + 1, y:next.y});
                        queue.push({x:next.x, y:next.y - 1});
                        queue.push({x:next.x, y:next.y + 1});
                    }
                }
            }
        }

        return {img:ghostly, left:this.bounds.left, top:this.bounds.top - Math.floor(this.amplitude * scale)};
    }

    predraw() {
        if (this.objects.length > 0) {
            this.img = this.calculate();
        }
    }

    draw() {
        if (this.img !== undefined) {
            other_ctx.clearRect(0, 0, other_canvas.width, other_canvas.height);
            other_ctx.putImageData(this.img.img, this.img.left, this.img.top);
            ctx.save();
            ctx.scale(1/scale, 1/scale);
            ctx.drawImage(other_canvas, 0, 0)
            ctx.restore();
            this.img = undefined;
        }
    }
}



class Button {
    constructor(x, y, size, symbol) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.depth = this.size/8;
        this.maxdepth = this.depth;
        this.symbol = symbol;
        this.pressed = false;
        this.click = false;
    }

    draw() {
        const r = this.size/4;

        ctx.beginPath();
        ctx.fillStyle = "#202020"
        draw_curved_rect(this.x - this.size/2 - 2, this.y - this.size/2 - 2, this.size + 4, this.size + 4, r);
        ctx.fill();

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + this.size/2 + this.depth - r * (1 - 1/Math.sqrt(2)), this.y + this.size/2 - this.depth - r * (1 - 1/Math.sqrt(2)));
        ctx.arc(this.x + this.size/2 - r, this.y + this.size/2 - r, r, Math.PI/4, Math.PI/2);
        ctx.arc(this.x - this.size/2 + r, this.y + this.size/2 - r, r, Math.PI/2, Math.PI);
        ctx.arc(this.x - this.size/2 + r, this.y - this.size/2 + r, r, Math.PI, Math.PI*5/4);
        ctx.lineTo(this.x - this.size/2 + this.depth + r * (1 - 1/Math.sqrt(2)), this.y - this.size/2 - this.depth + r * (1 - 1/Math.sqrt(2)));
        ctx.fillStyle = "#AD6177";
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        draw_curved_rect(this.x - this.size/2 + this.depth, this.y - this.size/2 - this.depth, this.size, this.size, r);
        ctx.fillStyle = "#D67893";
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(this.x + this.depth, this.y - this.depth);
        this.symbol(this.size);
        ctx.restore();
    }

    mouse_over(m_x, m_y) {
        return m_x >= this.x - this.size/2 && m_y >= this.y - this.size/2 - this.maxdepth && m_x <= this.x + this.size/2 + this.maxdepth && m_y <= this.y + this.size/2
    }

    update(m_x, m_y) {
        this.click = false;
        if (!this.pressed) {
            if (mouse.check(this) && this.mouse_over(m_x, m_y) && mouse.click === 2) {
                this.depth = 2;
                this.pressed = true;
            }
        } else {
            if (!this.mouse_over(m_x, m_y)) {
                this.depth = this.maxdepth;
                this.pressed = false;
            } else if (mouse.click === -1) {
                this.depth = this.maxdepth;
                this.pressed = false;
                this.click = true;
            }
        }
    }
}


class Keyhole {
    constructor(x, y, key_size) {
        this.x = x;
        this.y = y;
        this.key_size = key_size;
        this.depth = (this.key_size + 25) / 2;
        this.width = this.key_size * 3;
        this.height = this.key_size * 3;
        this.angle = 0;
        this.i = 0;
        this.to_advance = false;
        this.move_timer = 0;
        this.move_duration = 15;
        this.move_amount = 0;
        this.move_start = 0;


        const draw_step_arrow = function(s) {
            ctx.lineWidth = 4;
            ctx.fillStyle = "#F2C2D0";
            ctx.beginPath();
            ctx.arc(-s/7, -s/5, 3, Math.PI, Math.PI*5/3);
            ctx.arc(s/5, 0, 3, -Math.PI/3, Math.PI/3);
            ctx.arc(-s/7, s/5, 3, Math.PI/3, Math.PI);
            ctx.closePath();
            ctx.fill();
        }
        this.step_button = new Button(-this.width/4, -this.width/5, this.width/3, draw_step_arrow);
        const draw_fast_forward_arrow =  function(s) {
            ctx.lineWidth = 4;
            ctx.fillStyle = "#F2C2D0";
            ctx.beginPath();
            ctx.arc(s*2/30, -s*2/15, 2, Math.PI, Math.PI*5/3);
            ctx.arc(s*9/30, 0, 2, -Math.PI/3, Math.PI/3);
            ctx.arc(s*2/30, s*2/15, 2, Math.PI/3, Math.PI);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-s*7/30, -s*2/15, 2, Math.PI, Math.PI*5/3);
            ctx.arc(0, 0, 2, -Math.PI/3, Math.PI/3);
            ctx.arc(-s*7/30, s*2/15, 2, Math.PI/3, Math.PI);
            ctx.closePath();
            ctx.fill();
        }
        this.fast_button = new Button(-this.width/4, this.width/5, this.width/3, draw_fast_forward_arrow);
        const draw_reset_arrow = function(s) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#F2C2D0";
            ctx.beginPath();
            ctx.arc(s/20, 0, s/4, -Math.PI, Math.PI*3/4);
            ctx.stroke();

            ctx.beginPath();
            const point_x = -s/5;
            const point_y = 0;
            ctx.moveTo(point_x+6, point_y-2);
            ctx.lineTo(point_x, point_y);
            ctx.lineTo(point_x-3, point_y-4);
            ctx.stroke();
        }
        this.reset_button = new Button(this.width/4, -this.width/5, this.width/3, draw_reset_arrow);
        const draw_x_arrow = function(s) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#F2C2D0";
            ctx.beginPath();
            ctx.moveTo(-s/4, -s/4);
            ctx.lineTo(s/4, s/4);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(s/4, -s/4);
            ctx.lineTo(-s/4, s/4);
            ctx.stroke();
        }
        this.x_button = new Button(this.width/4, this.width/5, this.width/3, draw_x_arrow);
    }

    get_centre() {
        const left = this.x - this.depth/2;
        const top = this.y - this.depth/2 - this.height/2;
        const right = this.x + this.depth/2 + this.width;
        const bottom = this.y + this.height/2 + this.depth/2;

        return {x:this.x, y:this.y, left:left, right:right, top:top, bottom:bottom};
    }

    advance(length) {
        this.move_timer = this.move_duration;
        this.move_start = this.y;
        this.move_amount = length;
    }

    shift(amount) {
        this.y += amount;
        this.move_start += amount;
    }

    draw_back() {
        ctx.beginPath();
        ctx.moveTo(this.x + this.width + this.depth/2 - 20 * (1 - 1/Math.sqrt(2)), this.y + this.height/2 - this.depth/2 - 20 * (1 - 1/Math.sqrt(2)));
        ctx.arc(this.x - this.depth/2 + this.width - 20, this.y + this.depth/2 + this.height/2 - 20, 20, Math.PI/4, Math.PI/2);
        ctx.arc(this.x - this.depth/2 + 20, this.y + this.depth/2 + this.height/2 - 20, 20, Math.PI/2, Math.PI);
        ctx.arc(this.x - this.depth/2 + 20, this.y + this.depth/2 - this.height/2 + 20, 20, Math.PI, Math.PI*5/4);
        ctx.lineTo(this.x + this.depth/2 + 20 * (1 - 1/Math.sqrt(2)), this.y - this.height/2 - this.depth/2 + 20 * (1 - 1/Math.sqrt(2)));
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#707070";
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(1/2, 1);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.arc(0, 0, this.key_size/2 + 8, Math.PI/2, -Math.PI/2);
        ctx.fillStyle = "#757575";
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = "#000000"
        ctx.beginPath();
        ctx.arc(0, this.key_size/2, 3, Math.PI/2, Math.PI);
        ctx.arc(0, -this.key_size/2, 3, Math.PI, Math.PI*3/2);
        ctx.fill();
        ctx.restore();
    }

    draw_front() {
        ctx.fillStyle = "#707070";
        ctx.beginPath();
        ctx.moveTo(this.x - this.key_size/4 * Math.sin(this.angle), this.y + (this.key_size/2 + 5) * Math.cos(this.angle));
        ctx.lineTo(this.x + this.depth/2, this.y + this.key_size/2 * Math.cos(this.angle));
        ctx.lineTo(this.x + this.depth/2, this.y - this.key_size/2 * Math.cos(this.angle));
        ctx.lineTo(this.x + this.key_size/4 * Math.sin(this.angle), this.y - (this.key_size/2 + 5) * Math.cos(this.angle));
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(1/2, 1);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.arc(0, 0, this.key_size/2 + 8, -Math.PI/2, Math.PI/2);
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#757575";
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#000000"
        ctx.beginPath();
        ctx.arc(0, -this.key_size/2, 3, -Math.PI/2, 0);
        ctx.arc(0, this.key_size/2, 3, 0, Math.PI/2);
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.fillStyle = "#808080";
        ctx.strokeStyle = "#000000";
        draw_curved_rect(this.x + this.depth/2, this.y - this.depth/2 - this.height/2, this.width, this.height, 20);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(this.x + this.depth/2 + this.width/2, this.y - this.depth/2);
        this.step_button.draw();
        this.fast_button.draw();
        this.reset_button.draw();
        this.x_button.draw();
        ctx.restore();
    }

    update() {
        if (mouse.check(this)) {
            const m_x = mouse.x - this.x - this.depth/2 - this.width/2;
            const m_y = mouse.y - this.y + this.depth/2;
            this.step_button.update(m_x, m_y);
            this.reset_button.update(m_x, m_y);
            this.x_button.update(m_x, m_y);
            this.fast_button.update(m_x, m_y);
        }

        if (this.move_timer > 0) {
            this.move_timer--;
            const t = 1 - smooth_step(this.move_timer / this.move_duration);
            this.y = this.move_start + this.move_amount*t;
        }
    }
}

class Program {
    constructor() {
        this.memory = {};
        this.input = {};
    }

    get_input() {
        const result = [];
        for (let addr in this.input) {
            result.push({addr:addr, val:this.input[addr]});
        }
        return result;
    }

    get(addr, time, step) {
        if (step === undefined) {
            step = Infinity;
        }

        let val = 0;
        let i = 0;
        if (this.memory[addr] !== undefined) {
            while (i < this.memory[addr].length && precedes(this.memory[addr][i].t, this.memory[addr][i].step, time, step)) {
                val = this.memory[addr][i].val;
                i++;
            }
        }
        if (i === 0 && this.input[addr] !== undefined) {
            val = this.input[addr];
        }
        return val;
    }

    set(addr, val, time, step) {
        if (step === undefined) {
            step = Infinity;
        }

        if (time === undefined) {
            this.input[addr] = val;
        } else if (this.memory[addr] === undefined) {
            this.memory[addr] = [{t:time, val:val, step:step}];
        } else {
            let i = 0;
            while (i < this.memory[addr].length && precedes(this.memory[addr][i].t, this.memory[addr][i].step, time, step)) {
                i++;
            }
            if (i < this.memory[addr].length && this.memory[addr][i].t === time && this.memory[addr][i].step === step) {
                this.memory[addr][i].val = val;
            } else {
                this.memory[addr].splice(i, 0, {t:time, val:val, step:step});
            }
        }
    }

    reset() {
        this.memory = {};
    }

    reset_total() {
        this.memory = {};
        this.input = {};
    }
}


class Spark {
    constructor(pointer, x, y, colour, func) {
        this.p = pointer;
        this.from_x = x;
        this.from_y = y;
        this.colour = colour;

        const dx = this.p.particles[1].x - this.from_x;
        const dy = this.p.particles[1].y - this.from_y;
        if (dx === 0 && dy === 0) {
            this.start_duration = 10;
        } else {
            this.start_duration = Math.floor(Math.log(Math.max(Math.abs(Math.sqrt(dx*dx + dy*dy) / 123), 1)) * 15 + 20);
        }
        this.end_duration = Math.floor(this.start_duration * 1.4);
        this.start_t = 0;
        this.end_t = 0;

        this.f = func;
        this.activated = false;
    }

    get_centre() {
        const distances = this.distances();
        let ti = smooth_step(this.start_t / this.start_duration);
        let tf = smooth_step(this.end_t / this.end_duration);

        if (ti >= distances[0]) {
            ti = distances[0];
        }
        if (tf >= distances[0]) {
            tf = distances[0];
        }

        let r = ti / distances[0];
        const start_x = this.from_x * (1-r) + this.p.particles[1].x * r;
        const start_y = this.from_y + (this.p.particles[1].y - this.from_y) * smooth_step(r);
        
        r = tf / distances[0];
        const end_x = this.from_x * (1-r) + this.p.particles[1].x * r;
        const end_y = this.from_y + (this.p.particles[1].y - this.from_y) * smooth_step(r);

        return {x:start_x, y:start_y, left:end_x, top:start_y, right:start_x, bottom:end_y};
    }

    distances() {
        const dx = (this.p.particles[1].x - this.from_x);
        const dy = (this.p.particles[1].y - this.from_y);
        const d1 = 0.5 * Math.sqrt(dx*dx + dy*dy);
        const d2 = this.p.size/2 - this.p.radius;
        const d3 = Math.PI/2 * this.p.radius;
        const d4 = this.p.size - this.p.radius;
        const d5 = Math.PI/4 * this.p.radius;
        const d6 = this.p.radius/2 + (this.p.size/2 - this.p.radius) * Math.sqrt(2);
        const d7 = Math.PI/4 * this.p.radius;
        const total = d1+d2+d3+d4+d5+d6+d7;
        return [d1/total, (d1+d2)/total, (d1+d2+d3)/total, (d1+d2+d3+d4)/total, (d1+d2+d3+d4+d5)/total, (d1+d2+d3+d4+d5+d6)/total, 1]
    }

    update() {
        if (this.start_t < this.start_duration) {
            this.start_t += 1;
        } else if (!this.activated) {
            this.activated = true;
            if (this.f !== null) {
                this.f();
            }
        }

        if (this.end_t < this.end_duration) {
            this.end_t += 1;
        }
    }

    draw() {
        let distances = this.distances();

        const ti = smooth_step(this.start_t / this.start_duration);
        const tf = smooth_step(this.end_t / this.end_duration);

        let points = [tf];
        let cur = tf;
        let i = 0;
        const step = 0.03;
        while (distances[i] < cur) {
            i++;
        }
        while (cur < ti) {
            cur += step;
            if (cur > ti) {
                cur = ti;
            }
            while (distances[i] < cur) {
                points.push(distances[i]);
                i++;
            }
            points.push(cur);
        }

        let prev_t = -1;
        let prev_x = 0;
        let prev_y = 0;
        
        ctx.strokeStyle = "hsl("+this.colour+",80%,"+(Math.floor(Math.random()*0+95))+"%)";
        ctx.lineWidth = 5;
        ctx.save();
        for (let t of points) {
            let x = 0;
            let y = 0;
            if (t <= distances[0]) {
                const r = t / distances[0];
                x = this.from_x * (1-r) + this.p.particles[1].x * r;
                y = this.from_y + (this.p.particles[1].y - this.from_y) * smooth_step(r);
                if (prev_t >= 0) {
                    ctx.beginPath();
                    ctx.moveTo(prev_x, prev_y);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                }
            } else {
                if (prev_t <= distances[0]) {
                    ctx.translate(this.p.particles[0].x, this.p.particles[0].y);
                    ctx.rotate(this.p.angle);
                    prev_x = -this.p.size*3/2;
                    prev_y = 0;
                }
                if (t <= distances[1]) {
                    const r = (t - distances[0]) / (distances[1] - distances[0]);
                    x = -this.p.size*3/2;
                    y = (-this.p.size/2 + this.p.radius) * r;
                    if (prev_t >= 0) {
                        ctx.beginPath();
                        ctx.moveTo(prev_x, prev_y);
                        ctx.lineTo(x, y);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(prev_x, -prev_y);
                        ctx.lineTo(x, -y);
                        ctx.stroke();
                    }
                } else if (t <= distances[2]) {
                    const r = (t - distances[1]) / (distances[2] - distances[1]);
                    const cx_rel = -this.p.size*3/2 + this.p.radius;
                    const cy_rel = -this.p.size/2 + this.p.radius;
                    x = cx_rel - this.p.radius * Math.cos(r * Math.PI/2);    
                    y = cy_rel - this.p.radius * Math.sin(r * Math.PI/2);  
                    if (prev_t >= 0) {
                        ctx.beginPath();
                        const prev_r = (prev_t - distances[1]) / (distances[2] - distances[1]);
                        ctx.arc(-this.p.size*3/2 + this.p.radius, -this.p.size/2 + this.p.radius, this.p.radius, Math.PI + prev_r * Math.PI/2, Math.PI + r * Math.PI/2);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.arc(-this.p.size*3/2 + this.p.radius, this.p.size/2 - this.p.radius, this.p.radius, Math.PI - prev_r * Math.PI/2, Math.PI - r * Math.PI/2, true);
                        ctx.stroke();
                    }
                } else if (t <= distances[3]) {
                    const r = (t - distances[2]) / (distances[3] - distances[2]);
                    x = -this.p.size*3/2 + this.p.radius + (this.p.size - this.p.radius) * r;
                    y = -this.p.size/2;
                    if (prev_t >= 0) {
                        ctx.beginPath();
                        ctx.moveTo(prev_x, prev_y);
                        ctx.lineTo(x, y);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(prev_x, -prev_y);
                        ctx.lineTo(x, -y);
                        ctx.stroke();
                    }
                } else if (t <= distances[4]) {
                    const r = (t - distances[3]) / (distances[4] - distances[3]);
                    x = -this.p.size/2 + this.p.radius * Math.sin(r * Math.PI/4);
                    y = -this.p.size/2 + this.p.radius - this.p.radius * Math.cos(r * Math.PI/4);
                    if (prev_t >= 0) {
                        ctx.beginPath();
                        const prev_r = (prev_t - distances[3]) / (distances[4] - distances[3]);
                        ctx.arc(-this.p.size/2, -this.p.size/2 + this.p.radius, this.p.radius, -Math.PI/2 + prev_r * Math.PI/4, -Math.PI/2 + r * Math.PI/4);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.arc(-this.p.size/2, this.p.size/2 - this.p.radius, this.p.radius, Math.PI/2 - prev_r * Math.PI/4, Math.PI/2 - r * Math.PI/4, true);
                        ctx.stroke();
                    }
                } else if (t <= distances[5]) {
                    const r = (t - distances[4]) / (distances[5] - distances[4]);
                    x = (-this.p.size/2 + this.p.radius / Math.sqrt(2)) * (1-r) + (-this.p.radius/2 + this.p.radius/2/Math.sqrt(2)) * r;
                    y = (-this.p.size/2 + this.p.radius - this.p.radius / Math.sqrt(2)) * (1-r) + (-this.p.radius/2/Math.sqrt(2)) * r;
                    if (prev_t >= 0) {
                        ctx.beginPath();
                        ctx.moveTo(prev_x, prev_y);
                        ctx.lineTo(x, y);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(prev_x, -prev_y);
                        ctx.lineTo(x, -y);
                        ctx.stroke();
                    }
                } else {
                    const r = (t - distances[5]) / (1 - distances[5]);
                    x = this.p.radius/2 * (Math.cos(Math.PI/4 * (r - 1)) - 1);
                    y = this.p.radius/2 * Math.sin(Math.PI/4 * (r-1));
                    if (prev_t >= 0) {
                        ctx.beginPath();
                        const prev_r = (prev_t - distances[5]) / (1 - distances[5]);
                        ctx.arc(-this.p.radius/2, 0, this.p.radius/2, -Math.PI/4 + prev_r * Math.PI/4, -Math.PI/4 + r * Math.PI/4);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.arc(-this.p.radius/2, 0, this.p.radius/2, Math.PI/4 - prev_r * Math.PI/4, Math.PI/4 - r * Math.PI/4, true);
                        ctx.stroke();
                    }
                }
                
            }
            prev_t = t;
            prev_x = x;
            prev_y = y;
            t += step;
        }
        ctx.restore();
    }
}

class Clock {
    constructor(x, y, width, radius) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = this.width/4;
        this.radius = radius;
        this.spacing = this.height/10;
        this.parameter = new Parameter(this.height - 2*this.spacing, this.radius);
        this.parameter.value = 0;
        this.parameter.display = 0;
    }

    set(time) {
        this.parameter.value = time;
    }

    reset() {
        this.parameter.value = 0;
    }

    draw() {
        ctx.fillStyle = 'hsl(270, 80%, 80%)';
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        draw_curved_rect(this.x, this.y, this.width, this.height, this.radius);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(this.x + this.width - this.height/2, this.y + this.height/2);
        this.parameter.draw();
        ctx.restore();

        ctx.font = (this.height - 2*this.spacing) + "px Lexend";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "#000000";
        ctx.fillText("clock", this.x + this.radius - this.spacing, this.y + this.height/2);
    }

    update() {
        this.parameter.update();
    }
}


class Pointer {
    constructor(addr, x, y, size, radius, value) {
        if (value === undefined) {
            value = 0;
        }
        
        this.addr = addr;

        this.size = size;
        this.radius = radius;
        this.spacing = this.size/10;
        this.particles = [new Particle(x, y), new Particle(x - this.size * 3/2, y)];
        this.links = [new Link(this.particles[0], this.particles[1])];
        this.parameter = new Parameter(this.size - 2*this.spacing, this.radius);
        this.value = value;
        this.parameter.value = this.value;
        this.parameter.display = this.parameter.value;

        this.angle = 0;

        this.from = 0;
        this.to = 0;
        this.move_timer = 0;
        this.move_duration = 15;

        this.x_shift = 0;
        this.shift_timer = 0;
        this.shift_duration = 15;

        this.new_val = null;
        this.output_val = 0
        this.door_duration = 40;
        this.door_t = 0;
        this.door_open = false;

        this.sparks = [];

        this.colour = 'hsl(0, 80%, 80%)';
    }

    get_centre() {
        const x = (this.particles[0].x + this.particles[1].x) / 2;
        const y = (this.particles[0].y + this.particles[1].y) / 2;

        let output_shift = 0;
        if (this.door_open) {
            const size = 2*this.size - 4*this.radius - 20;
            ctx.font = size + " px Lexend"
            output_shift = ctx.measureText(this.output_val + "").width + 25;
        }
        const left = this.particles[1].x - this.size - output_shift;
        const top = this.particles[0].y - this.size;
        const right = this.particles[0].x  + this.radius;
        const bottom = this.particles[0].y + this.size;
        return {x:x, y:y, left:left, right:right, top:top, bottom:bottom};
    }

    xshift(amount) {
        this.particles[0].x += amount;
        this.particles[1].x += amount;
        this.particles[0].prev_x += amount;
        this.particles[1].prev_x += amount;
    }

    shift(amount) {
        this.particles[0].y -= amount;
        this.particles[0].prev_y -= amount;
        this.particles[1].y -= amount;
        this.particles[1].prev_y -= amount;
        this.from -= amount;
        this.to -= amount;
    }

    move(addr, y) {
        this.addr = addr;
        this.from = this.particles[0].y;
        this.to = y;
        if (this.to === this.from) {
            this.move_duration = 0;
        } else {
            this.move_duration = Math.floor(Math.log(Math.max(Math.abs((this.to - this.from) / 200),1)) * 15 +  12);
        }
        this.move_timer = this.move_duration;
    }

    set(val) {
        this.parameter.value = val;
        this.value = val;
    }

    spark(x, y, colour, f) {
        this.sparks.push(new Spark(this, x, y, colour, f));
    }

    draw_paper(xl, xr, unfold) {
        if (unfold > 0) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(xl, -this.size/2 + this.radius + 3, xr - xl, this.size - 2*this.radius - 6);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(xl, -this.size/2 + this.radius + 3);
            ctx.lineTo(xl, this.size/2 - this.radius - 3);
            ctx.lineTo(xr, this.size/2 - this.radius - 3);
            ctx.lineTo(xr, -this.size/2 + this.radius + 3);
            ctx.stroke();
            ctx.save();
            ctx.clip();

            ctx.fillStyle = "#000000";
            ctx.fillText(this.output_val + '', (xl + xr)/2, -this.size/2 + this.radius + 3);
            ctx.restore();
        }

        if (unfold < 0.5) {
            ctx.fillStyle = "#E0E0E0";
        } else {
            ctx.fillStyle = "#FFFFFF"
        }

        const xshift = -Math.sin(unfold * Math.PI) / 2;
        const yscale = -Math.cos(unfold * Math.PI);
        ctx.save();
        ctx.translate((xr + xl)/2, -this.size/2 + this.radius + 3);
        ctx.scale(1, yscale);
        ctx.transform(1, 0, xshift, 1, 0, 0);

        ctx.beginPath();
        ctx.moveTo((xl - xr)/2, 0);
        ctx.lineTo((xl - xr)/2, -this.size + 2*this.radius + 6);
        ctx.lineTo((xr - xl)/2, -this.size + 2*this.radius + 6);
        ctx.lineTo((xr - xl)/2, 0);
        ctx.fill();
        ctx.clip();
        
        if (unfold > 0.5) {
            ctx.fillStyle = "#000000";
            ctx.fillText(this.output_val + '', 0, 0);
        }
        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(xl, -this.size/2 + this.radius + 3);
        const edge_x = -xshift * (this.size - 2*this.radius - 6);
        const edge_y = -this.size/2 + this.radius + 3 - yscale * (this.size - 2*this.radius - 6);
        ctx.lineTo(xl + edge_x, edge_y);
        ctx.lineTo(xr + edge_x, edge_y);
        ctx.lineTo(xr, -this.size/2 + this.radius + 3);
        if (unfold < 0.5) {
            ctx.closePath();
        }
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
    }

    draw() {
        const theta = this.angle;
        ctx.save();
        ctx.translate(this.particles[0].x + this.x_shift, this.particles[0].y);
        ctx.rotate(theta);

        //door
        if (this.door_t > 0) {
            ctx.fillStyle = "#505050";
            ctx.fillRect(-this.size*3/2, -this.size/2 + this.radius, this.spacing/2, this.size - 2*this.radius);
        }

        const door_t1 = 1 - smooth_step(Math.min(1, 3 * this.door_t / this.door_duration));
        const door_size = (this.size/2 - this.radius) * door_t1;
        ctx.fillStyle = this.colour;
        ctx.fillRect(-this.size*3/2, -this.size/2 + this.radius, this.spacing/2, door_size);

        ctx.fillRect(-this.size*3/2, this.size/2 - this.radius - door_size, this.spacing/2, door_size);

        ctx.beginPath();
        ctx.moveTo(-this.size*3/2 + this.spacing/2, -this.size/2 + this.radius + door_size);
        ctx.lineTo(-this.size*3/2, -this.size/2 + this.radius + door_size);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-this.size*3/2, this.size/2 - this.radius - door_size);
        ctx.lineTo(-this.size*3/2 + this.spacing/2, this.size/2 - this.radius - door_size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-this.size*3/2, -this.size/2 + this.radius);
        ctx.lineTo(-this.size*3/2, this.size/2 - this.radius);
        ctx.stroke();

        if (this.door_t > this.door_duration / 3) {
            const size = 2*this.size - 4*this.radius - 20;
            ctx.font = size + "px Lexend"
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const paper_width = ctx.measureText(this.output_val + '').width + 10;
            const stick_length = 15;

            const door_t2 = smooth_step(Math.min(1, 3 * (this.door_t - this.door_duration / 3) / this.door_duration));
            const left_side = (paper_width + stick_length) * door_t2;
            if (left_side > paper_width) {
                ctx.beginPath();
                ctx.moveTo(-this.size*3/2 + this.spacing/2, 0);
                ctx.lineTo(-this.size*3/2 + this.spacing/2 - left_side + paper_width, 0);
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 5;
                ctx.stroke();
                ctx.strokeStyle = "#A0B0B0";
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            const unfold = smooth_step(Math.max(0, this.door_t - this.door_duration *2/3) / this.door_duration * 3)
            this.draw_paper(-this.size*3/2 + this.spacing/2 - left_side, -this.size*3/2 + this.spacing/2 + Math.min(-left_side + paper_width, 0), unfold);
        }

        //main
        ctx.beginPath();
        ctx.arc(-this.radius/2, 0, this.radius/2, -Math.PI/4, Math.PI/4);
        ctx.arc(-this.size/2, this.size/2 - this.radius, this.radius, Math.PI/4, Math.PI/2);
        ctx.arc(-this.size*3/2 + this.radius, this.size/2 - this.radius, this.radius, Math.PI/2, Math.PI);
        ctx.lineTo(-this.size*3/2 + this.spacing/2, this.size/2 - this.radius);
        ctx.lineTo(-this.size*3/2 + this.spacing/2, -this.size/2 + this.radius);
        ctx.arc(-this.size*3/2 + this.radius, -this.size/2 + this.radius, this.radius, Math.PI, Math.PI*3/2);
        ctx.arc(-this.size/2, -this.size/2 + this.radius, this.radius, -Math.PI/2, -Math.PI/4);
        ctx.closePath();
        ctx.fillStyle = this.colour;
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.translate(-this.size, 0);
        this.parameter.draw();
        ctx.restore();

        for (let s of this.sparks) {
            s.draw();
        }
    }

    update() {
        this.angle = Math.atan2(this.particles[0].y - this.particles[1].y, this.particles[0].x - this.particles[1].x);

        if (this.move_timer > 0) {
            this.move_timer--;
            const t = 1 - smooth_step(this.move_timer / this.move_duration);
            this.particles[0].y = this.from * (1 - t) + this.to * t;
        }

        if (this.shift_timer > 0) {
            this.shift_timer--;
            const t = 1 - this.shift_timer / this.shift_duration;
            if (t < 0.5) {
                const t2 = smooth_step((t) / 0.5);
                this.x_shift = 20 * t2;
            } else {
                const t3 = smooth_step((t - 0.5) / 0.5);
                this.x_shift = 20 - t3 * 20;
            }
        }

        this.particles[1].move(0.85);
        this.particles[1].y += (this.particles[0].y - this.particles[1].y) * 0.1;
        for (let _ = 0; _ < 1; _++) {
            for (let l of this.links) {
                l.constrain(1);
            }
        }

        const dx = mouse.x - this.particles[0].x;
        const dy = mouse.y - this.particles[0].y;


        for (let i = this.sparks.length-1; i >= 0; i--) {
            this.sparks[i].update();
            if (this.sparks[i].end_t >= this.sparks[i].end_duration) {
                this.sparks.splice(i, 1);
            }
        }

        this.parameter.update();
        if (this.parameter.value === null) {
            this.parameter.value = this.value;
            this.parameter.display = this.value;
        } else if (this.value !== this.parameter.value) {
            this.value = this.parameter.value;
        }

        if (this.door_open) {
            if (this.door_t < this.door_duration) {
                this.door_t += 1;
            }
        } else {
            if (this.door_t > 0) {
                this.door_t -= 1;
            }
        }

        if (this.new_val !== null && this.door_t === 0) {
            this.output_val = this.new_val;
            this.door_open = true;
            this.new_val = null;
        }
    }

    out(val) {
        this.new_val = val;
        this.door_open = false;
    }
}


class Register {
    constructor(program, address, value, size, radius) {
        this.size = size;
        this.radius = radius;
        this.spacing = this.size/10;
        this.program = program;
        
        this.address = address;
        this.value = value;
        this.parameter = new Parameter(this.size - 2*this.spacing, this.radius);
        this.parameter.value = this.value;
        this.parameter.display = this.parameter.value;
    }

    set(val) {
        this.value = val;
        this.parameter.value = val;
    }

    update(mx, my) {
        this.parameter.update((mx) / (this.size/2 - this.spacing), (my - this.size/4) / (this.size/2 - this.spacing), mouse.click);
        if (this.parameter.value === null) {
            this.parameter.value = this.value;
            this.parameter.display = this.value;
        } else if (this.value !== this.parameter.value) {
            this.value = this.parameter.value;
            //block this while program running.
            this.program.set(this.address, this.value);
        }
    }

    draw() {
        ctx.lineWidth = 2;
        ctx.fillStyle = 'hsl(210, 80%, 80%)';
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        draw_curved_rect(-this.size/2, -this.size*3/4, this.size, this.size*3/2, this.radius);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const size = this.size/3;
        ctx.font = size + "px Lexend";
        ctx.fillStyle = "#000000";
        ctx.fillText(this.address+"", 0, -this.size*3/8);

        ctx.save();
        ctx.translate(0, this.size/4);
        this.parameter.draw();
        ctx.restore();
    }

    reset() {
        this.parameter.value = this.program.get(this.address, 0);
        this.value = this.parameter.value;
    }
}


class Memory {
    constructor(program) {
        this.program = program;
        this.registers = [];

        this.ghostly_registers = [];
        this.ghostly_counter = 0;
        this.ghostly_duration = 120;

        this.time = 0;
        this.write_amount = 0;
        this.write_addr = null;

        this.block_height = 123;
        this.shift = -this.block_height * 1.5
        this.update_registers(this.registers, this.time);

        this.pointer = new Pointer(0, canvas_width - 95, this.block_height/2 - this.shift, 75, 19);
        this.clock = new Clock(canvas_width - 395, 5, 300, 19);
    }

    scroll(amount) {
        this.shift += amount;
        this.pointer.shift(amount);
    }

    set_time(time, anim) {
        this.clock.set(time);

        if (anim) {
            this.update_registers(this.ghostly_registers, this.clock.parameter.value);
            this.ghostly_counter = this.ghostly_duration;
        } else {
            this.time = time;
        }
    }

    update_registers(register_list, time) {
        const first = Math.floor(this.shift / this.block_height);
        const last = Math.floor((this.shift + canvas_height) / this.block_height);

        while (register_list.length > 0 && register_list[0].address < first) {
            register_list.splice(0, 1)
        }
        let to_add_end = last;
        if (register_list.length > 0) {
            to_add_end = register_list[0].address - 1;
        }
        for (let i = first; i <= to_add_end; i++) {
            register_list.splice(i - first, 0, new Register(this.program, i, this.program.get(i, time), 75, 19));
        }

        while (register_list.length > 0 && register_list[register_list.length-1].address > last) {
            register_list.pop();
        }
        let to_add_start = first;
        if (register_list.length > 0) {
            to_add_start = register_list[register_list.length-1].address + 1;
        }
        for (let i = to_add_start; i <= last; i++) {
            register_list.push(new Register(this.program, i, this.program.get(i, time), 75, 19));
        }
    }

    update(editable) {
        this.pointer.update();
        this.clock.update();

        this.update_registers(this.registers, this.time);

        if (this.ghostly_registers.length > 0) {
            this.update_registers(this.ghostly_registers, this.clock.parameter.value);

            this.ghostly_counter -= 1;

            for (let r of this.ghostly_registers) {
                let x;
                let y;
                if (r.address === this.write_addr) {
                    x = canvas_width - 48 + this.write_amount;
                    y = (r.address + 1/2) * this.block_height - this.shift;
                } else {
                    x = canvas_width - 48;
                    y = (r.address + 1/2) * this.block_height - this.shift;
                }
                ghostliness.add_object(this.draw_register.bind(this, r), x, y, (1 - smooth_step(this.ghostly_counter / this.ghostly_duration)) * 2, x - 40, y - 60, x + 40, y + 60);
            }

            if (this.ghostly_counter <= 0) {
                this.registers = this.ghostly_registers;
                this.ghostly_registers = [];
                this.time = this.clock.parameter.value;
            }
        }

        for (let r of this.registers) {
            const y = (r.address + 1/2) * this.block_height - this.shift;
            if (editable) {
                r.update(mouse.x - canvas_width + 48, mouse.y - y);
            } else {
                r.update();
            }

        }
    }

    draw_register(r) {
        ctx.save();
        if (r.address === this.write_addr) {
            ctx.translate(canvas_width - 48 + this.write_amount, (r.address + 1/2) * this.block_height - this.shift);
        } else {
            ctx.translate(canvas_width - 48, (r.address + 1/2) * this.block_height - this.shift);
        }
        r.draw();
        ctx.restore();
    }

    draw() {
        if (this.ghostly_registers.length > 0) {
            ctx.save();
            ctx.globalAlpha = smooth_step(this.ghostly_counter / this.ghostly_duration);
        }
        for (let r of this.registers) {
            this.draw_register(r);
        }
        if (this.ghostly_registers.length > 0) {
            ctx.restore();
        }

        this.pointer.draw();
    }

    reset() {
        for (let r of this.registers) {
            r.reset();
        }
        this.time = 0;
        this.pointer.move(0, this.block_height/2 - this.shift);
        this.pointer.set(0);
        this.pointer.door_open = false;
        this.clock.reset();
    }

    write(addr, value, step) {
        this.program.set(addr, value, this.time, step);

        const first = Math.floor(this.shift / this.block_height);
        const last = Math.floor((this.shift + canvas_height) / this.block_height);
        if (addr >= first && addr <= last) {
            const i = addr - first;
            this.registers[i].set(value);
        }
    }

    resize(old_width) {
        this.pointer.xshift(canvas_width - old_width);
        this.clock.x += canvas_width - old_width;
    }
}


class Anim {
    constructor(key, box, pointer, val, time, mem, delay) {
        this.key = key;
        this.box = box;
        this.pointer = pointer;
        this.val = val;
        this.mem = mem;
        this.t = time;

        this.sparked = false;

        this.delay = delay;

        this.finished = false;

        this.to_write = false;
    }

    initiate() {
        if (this.mem.time !== this.t) {
            this.mem.set_time(this.t, false);
        }
        this.key.turn(this.box);
    }

    spark() {
        const f = this[this.key.text].bind(this);
        this.pointer.spark(this.box.x + this.box.width, this.box.y, this.key.colour, f);
    }

    handle_write_anim() {
        if (this.pointer.x_shift > 0) {
            this.mem.write_amount = this.pointer.x_shift;
            this.mem.write_addr = this.pointer.addr;            
            if (this.to_write) {
                this.to_write = false;
                this.mem.write(this.pointer.addr, this.pointer.value, this.box.i);
            }
        } else if (this.mem.write_addr !== null) {
            this.mem.write_addr = null;
        }
    }

    update() {
        if (!this.sparked) {
            if (this.key.turning === 3) {
                this.spark();
                this.sparked = true;
            }
        } else {
            this.handle_write_anim();            

            if (this.pointer.sparks.length === 0) {
                if (this.delay > 0) {
                    this.delay -= 1;
                } else { 
                    this.finished = true;
                }
            }
        }
    }

    pos() {
        const y = (this.val + 1/2) * this.mem.block_height - this.mem.shift;
        this.pointer.move(this.val, y);
    }

    read() {
        this.pointer.set(this.val);
    }

    add() {
        this.pointer.set(this.pointer.value + this.val);
    }

    sub() {
        this.pointer.set(this.pointer.value - this.val);
    }

    time() {
        this.mem.set_time(this.val, true);
    }

    write() {
        this.pointer.shift_timer = this.pointer.shift_duration;
        this.to_write = true;
    }

    out() {
        this.pointer.out(this.val);
    }
}

class GhostlyAnim  extends Anim {
    constructor(key, box, pointer, val, time, mem, delay) {
        super(key, box, pointer, val, time, mem, delay);

        this.duration = 15;
        this.key_strength = 0;
        this.box_delay = 10;
        this.box_strength = 0;
        this.pointer_strength = 0;

        this.pter_xi = this.pointer.particles[0].x;
        this.pter_xf = this.pointer.particles[1].x;
        this.pointer_shift = 100;
        this.pointer.particles[0].x -= this.pointer_shift;
        this.pointer.particles[1].x -= this.pointer_shift;

        this.finished = false;
    }

    update(time) {
        if (!this.sparked) {
            if (this.pointer_strength < this.duration) {
                this.pointer_strength += 1;

                const shift = this.pointer_shift * (1 - smooth_step(this.pointer_strength / this.duration));
                this.pointer.particles[0].x = this.pter_xi - shift;
                this.pointer.particles[1].x = this.pter_xf - shift;
            } else {
                if (this.key_strength < this.duration) {
                    this.key_strength += 1;
                }
                if (this.box_delay > 0) {
                    this.box_delay -= 1;
                } else if (this.box_strength < this.duration) {
                    this.box_strength += 1;
                }

                if (this.key.turning === 3) {
                    this.spark();
                    this.sparked = true;
                }
            }
        } else {
            this.handle_write_anim();

            if (this.key.turning === 0) {
                if (this.key_strength > 0) {
                    this.key_strength -= 1;
                }
                if (this.box_strength > 0) {
                    this.box_strength -= 1;
                }
            }

            if (this.pointer.sparks.length === 0) {
                if (this.delay > 0) {
                    this.delay -= 1;
                } else if (this.pointer_strength > 0) {
                    this.pointer_strength -= 1;
                } else {
                    this.finished = true;
                }
            }
        }

        for (let s of this.pointer.sparks) {
            const centre = s.get_centre();
            ghostliness.add_object(s.draw.bind(s), centre.x, centre.y, 1, centre.left - 3, centre.top - 3, centre.right + 3, centre.bottom + 3);
        }

        const box_centre = this.box.get_centre();
        if (this.box_strength > 0) {
            ghostliness.add_object(this.box.draw_back.bind(this.box), box_centre.x, box_centre.y, smooth_step(this.box_strength / this.duration), box_centre.left - 3, box_centre.top - 3, box_centre.right + 3, box_centre.bottom + 3);
        }
        if (this.key_strength > 0) {
            this.key.update(time);
            const centre = this.key.get_centre();
            ghostliness.add_object(this.key.draw.bind(this.key), centre.x, centre.y, smooth_step(this.key_strength / this.duration), centre.left - 3, centre.top - 3, centre.right + 3, centre.bottom + 3);
        }
        if (this.box_strength > 0) {
            this.box.update(time);
            ghostliness.add_object(this.box.draw_front.bind(this.box), box_centre.x, box_centre.y, smooth_step(this.box_strength / this.duration), box_centre.left - 3, box_centre.top - 3, box_centre.right + 3, box_centre.bottom + 3);
        }
        if (this.pointer_strength > 0) {
            this.pointer.update(time);
            const centre = this.pointer.get_centre();
            ghostliness.add_object(this.pointer.draw.bind(this.pointer), centre.x, centre.y, smooth_step(this.pointer_strength / this.duration), centre.left, centre.top, centre.right + 3, centre.bottom);
        }
    }

    time() {}
}


class WarningWindow {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        
        this.width = 600;
        this.height = 300;

        this.banner_height = 70;
        this.banner_radius = 10;

        this.icon_side_length = this.height/2;
        this.icon_spacing = 20;
        this.icon_radius = 20;

        this.button_height = 60;
        this.button_width = 200;
        this.clicked = false;

        this.min_x_scale = 0.98;
        this.min_y_scale = 0.98;
        this.max_x_scale = 1.02;
        this.max_y_scale = 1.02;
        this.x_scale = this.min_x_scale;
        this.y_scale = this.min_y_scale;
        this.scale_counter = 0;
        this.scale_duration = 15;

        this.delay = 5;
        this.delay_counter = 0;
        this.done = false;

        mouse.claim(this);
    }

    update() {
        if (this.scale_counter < this.scale_duration) {
            this.scale_counter += 1;

            const t = this.scale_counter / this.scale_duration;
            const ax = (this.min_x_scale - this.max_x_scale) / 0.36;
            const bx = 1.2 * ax;
            const cx = this.min_x_scale;
            this.x_scale =  ax * t * t - bx * t + cx;

            const ay = (this.min_y_scale - this.max_y_scale) / 0.36;
            const by = 1.2 * ay;
            const cy = this.min_y_scale;
            this.y_scale = ay * t * t - by * t + cy;
        } else {
            if (this.clicked && mouse.click < 0) {
                this.delay_counter++;
                mouse.unclaim(this);
            }

            if (this.delay_counter > 0) {
                this.delay_counter++;
                if (this.delay_counter >= this.delay) {
                    this.done = true;
                }
            }
            
            if (mouse.x > this.x - this.button_width/2 && mouse.x < this.x + this.button_width/2 &&
                   mouse.y > this.y + this.height/2 - this.icon_spacing - this.button_height && mouse.y < this.y + this.height/2 - this.icon_spacing &&
                   mouse.click > 0) {
                if (!this.clicked && mouse.click === 2) {
                    this.clicked = true;
                }
            } else {
                this.clicked = false;
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.x_scale, this.y_scale);

        ctx.fillStyle = "#E9E7D8";
        ctx.fillRect(- this.width/2, - this.height/2 + this.banner_height, this.width, this.height - this.banner_height);

        ctx.fillStyle = "#0155E6";
        ctx.beginPath();
        ctx.arc(- this.width/2 + this.banner_radius, - this.height/2 + this.banner_radius, this.banner_radius, Math.PI, Math.PI*3/2);
        ctx.arc(this.width/2 - this.banner_radius, - this.height/2 + this.banner_radius, this.banner_radius, -Math.PI/2, 0);
        ctx.lineTo(this.width/2, - this.height/2 + this.banner_height);
        ctx.lineTo(- this.width/2, - this.height/2 + this.banner_height);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(- this.width/2, - this.height/2 + this.banner_radius);
        ctx.lineTo(- this.width/2, this.height/2);
        ctx.lineTo(this.width/2, this.height/2);
        ctx.lineTo(this.width/2 , - this.height/2 + this.banner_radius);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(- this.width/2 + this.icon_spacing + this.icon_radius, - this.height/2 + this.banner_height + this.icon_spacing + this.icon_side_length*Math.sqrt(3)/2 - this.icon_radius, this.icon_radius, Math.PI/2, Math.PI*7/6);
        ctx.arc(- this.width/2 + this.icon_spacing + this.icon_side_length/2, - this.height/2 + this.icon_spacing + this.icon_radius + this.banner_height, this.icon_radius, Math.PI*7/6, Math.PI*11/6);
        ctx.arc(- this.width/2 + this.icon_spacing + this.icon_side_length - this.icon_radius, - this.height/2 + this.banner_height + this.icon_spacing + this.icon_side_length*Math.sqrt(3)/2 - this.icon_radius, this.icon_radius, -Math.PI/6, Math.PI/2);
        ctx.closePath();
        ctx.fillStyle = "#FFD302";
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#000000";
        ctx.font = this.icon_side_length*2/3 + "px Lexend";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", - this.width/2 + this.icon_spacing + this.icon_side_length/2, - this.height/2 + this.banner_height + this.icon_spacing + this.icon_side_length * Math.sqrt(3)*7/24);

        ctx.font = this.banner_height*2/3 + "px Lexend";
        ctx.textAlign = "left";
        ctx.fillStyle = "#000000";
        ctx.fillText("Warning", - this.width/2 + this.icon_spacing + 3, - this.height/2 + this.banner_height/2 + 3);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText("Warning", - this.width/2 + this.icon_spacing, - this.height/2 + this.banner_height/2);

        ctx.fillStyle = "#000000";
        ctx.font = this.banner_height/2 + "px Lexend";
        ctx.fillText("Temporal instability", - this.width/2 + this.icon_spacing*2 + this.icon_side_length, - this.height/2 + this.banner_height + this.icon_spacing + this.icon_side_length*7/24);
        ctx.fillText("detected.", - this.width/2 + this.icon_spacing*2 + this.icon_side_length, - this.height/2 + this.banner_height + this.icon_spacing + this.icon_side_length*(Math.sqrt(3)*12 - 7)/24);
        
        ctx.beginPath();
        ctx.arc(- this.button_width/2 + this.banner_radius, this.height/2 - this.icon_spacing - this.button_height + this.banner_radius, this.banner_radius, Math.PI, Math.PI*3/2);
        ctx.arc(this.button_width/2 - this.banner_radius, this.height/2 - this.icon_spacing - this.button_height + this.banner_radius, this.banner_radius, -Math.PI/2, 0);
        ctx.arc(this.button_width/2 - this.banner_radius, this.height/2 - this.icon_spacing - this.banner_radius, this.banner_radius, 0, Math.PI/2);
        ctx.arc(- this.button_width/2 + this.banner_radius, this.height/2 - this.icon_spacing - this.banner_radius, this.banner_radius, Math.PI/2, Math.PI);
        ctx.closePath();
        if (this.clicked) {
            ctx.fillStyle = "#EBEAF4";
        } else {
            ctx.fillStyle = "#F9F9F7";
        }
        ctx.fill();

        if (!this.clicked) {
            ctx.beginPath();
            ctx.arc(this.button_width/2 - this.banner_radius, this.height/2 - this.icon_spacing - this.banner_radius, this.banner_radius, 0, Math.PI/2);
            ctx.arc(- this.button_width/2 + this.banner_radius, this.height/2 - this.icon_spacing - this.banner_radius, this.banner_radius, Math.PI/2, Math.PI);
            ctx.fillStyle = "#EBEAF4";
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(- this.button_width/2 + this.banner_radius, this.height/2 - this.icon_spacing - this.button_height + this.banner_radius, this.banner_radius, Math.PI, Math.PI*3/2);
        ctx.arc(this.button_width/2 - this.banner_radius, this.height/2 - this.icon_spacing - this.button_height + this.banner_radius, this.banner_radius, -Math.PI/2, 0);
        ctx.arc(this.button_width/2 - this.banner_radius, this.height/2 - this.icon_spacing - this.banner_radius, this.banner_radius, 0, Math.PI/2);
        ctx.arc(- this.button_width/2 + this.banner_radius, this.height/2 - this.icon_spacing - this.banner_radius, this.banner_radius, Math.PI/2, Math.PI);
        ctx.closePath();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.fillText("Resolve", 0, this.height/2 - this.icon_spacing - this.button_height/2);
        ctx.restore();
    }
}


class Control {
    constructor() {
        let commands = [
            new Command("read", true, 0, 300, 100),
            new Command("write", false, 30, 300, 200),
            new Command("add", true, 60, 300, 300),
            new Command("sub", true, 120, 300, 400),
            new Command("pos", true, 210, 300, 500),
            new Command("time", true, 270, 300, 600),
            new Command("out", true, 300, 300, 700)
        ]

        this.commands = [];
        this.order = [];
        while (commands.length > 0) {
            const i = Math.floor(Math.random() * commands.length);
            this.order.push(commands[i]);
            commands.splice(i, 1);
        }
        this.delay = 0;

        this.selected = null;

        this.to_remove = [];

        this.code_shift = 0;

        this.selected_block = null;
        this.code = [];
        this.code_block_start_x = 850;
        this.code_block_height = 100;
        this.code_block_width = 445;
        this.animating = null;

        this.triggered = false;

        this.prog_running = false;
        this.editable = true;
        this.compiler = null;
        this.auto = false;
        this.box = new Keyhole(this.code_block_start_x + this.code_block_width + 50, 30 + this.code_block_height/2, 38);

        this.pointers = [];
        this.animations = [];
        this.animation = null;
    
        this.prog = new Program();
        this.mem = new Memory(this.prog);

        this.speed = 1;

        this.window = null;
    }

    draw() {
        if (this.selected_block !== null) {
            ctx.fillStyle = "#D0D0D0";
            draw_curved_rect(this.code_block_start_x, 30 + this.selected_block*this.code_block_height + this.code_shift, this.code_block_width, this.code_block_height, 20);
            ctx.fill();
        }

        let size = this.code.length * this.code_block_height;
        let max_code_height = 0;
        let min_code_height = Math.min(0, this.code_block_height - size);
        ctx.strokeStyle = "#D0D0D0";
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.code_block_start_x - 40, 20);
        ctx.lineTo(this.code_block_start_x - 40, canvas_height - 20);
        ctx.stroke();

        ctx.strokeStyle = "#808080";
        ctx.lineWidth = 20;
        const start_point = -this.code_shift;
        const end_point = start_point + canvas_height - 60;
        const top = 0;
        const bottom = canvas_height - 60 + max_code_height - min_code_height;
        ctx.beginPath();
        ctx.moveTo(this.code_block_start_x - 40, (start_point - top) / (bottom - top) * (canvas_height - 40) + 20);
        ctx.lineTo(this.code_block_start_x - 40, (end_point - top) / (bottom - top) * (canvas_height - 40) + 20);
        ctx.stroke();

        this.mem.draw();

        for (let c of this.commands) {
            c.draw();
        }

        this.box.draw_back();
        for (let i = 0; i < this.code.length; i++) {
            if (i !== this.animating) {
                this.code[i].draw();
            }
        }
        this.box.draw_front();

        if (this.animating !== null) {
            this.code[this.animating].draw();
        }
        
        if (this.selected !== null) {
            this.selected.draw();
        }

        for (let c of this.to_remove) {
            c.draw();
        }

        if (this.window !== null) {
            this.window.draw();
        }
    }

    compile() {
        this.pointers = this.compiler.get_visible_pointers();
    }

    get_val(command, pointer, time, step) {
        let val = null;
        if (command.parameter) {
            if (command.box.value === null) {
                val = this.mem.program.get(pointer.addr, time, step);
            } else {
                val = command.box.value;
            }
        }
        return val;
    }

    make_animation(a) {
        if (a.step === this.box.i) {
            let val = this.get_val(this.code[this.box.i], this.mem.pointer, this.mem.time, a.step);
            return new Anim(this.code[this.box.i], this.box, this.mem.pointer, val, a.time, this.mem, 60);
        } else {
            let comm;
            if (this.code[a.step].parameter) {
                comm = new Command(this.code[a.step].text, true, this.code[a.step].colour, this.code[a.step].width, 0, this.code[a.step].box.value);
            } else {
                comm = new Command(this.code[a.step].text, false, this.code[a.step].colour, this.code[a.step].width, 0);
            }
            comm.make_ghostly();
            comm.jump_to(this.code_block_start_x + comm.spacing, 30 + (a.step + 0.5) * this.code_block_height + this.code_shift);

            const keyhole = new Keyhole(this.code_block_start_x + this.code_block_width + 50, 30 + this.code_block_height * (a.step + 0.5) + this.code_shift, 38);
            keyhole.i = a.step;

            const pointer = new Pointer(a.addr, canvas_width - 95, (a.addr + 0.5) * this.mem.block_height - this.mem.shift, 75, 19, a.val);

            let val = this.get_val(comm, pointer, this.mem.time, a.step);

            return new GhostlyAnim(comm, keyhole, pointer, val, a.time, this.mem, 60);
        }
    }

    update_actual(time) {
        if (this.order.length > 0) {
            if (this.delay === 0) {
                this.commands.push(this.order.pop());
                this.delay = 15;
            } else {
                this.delay--;
            }
        }

        const old_block = this.selected_block;
        this.selected_block = null;
        for (let i = this.commands.length - 1; i >= 0; i--) {
            this.commands[i].update(time);
            if (this.commands[i].drag === 1) {
                this.selected = this.commands[i];
                this.commands.splice(i, 1);
            }
        }

        if (this.animation !== null) {
            this.animation.update(time);
            if (this.animation.finished) {
                if (this.animations.length > 0) {
                    this.animation = this.make_animation(this.animations[0]);
                    this.animation.initiate();
                    this.animations.splice(0, 1);
                } else {
                    this.animation = null;
                    if (this.code[this.box.i].text !== "time") {
                        this.mem.set_time(this.mem.time + 1, false);
                    }
                    this.box.advance(this.code_block_height);
                    this.box.i += 1;
    
                    if (this.box.i >= this.code.length) {
                        this.auto = false;
                        this.speed = 1;
                        if (!this.compiler.done) {
                            this.window = new WarningWindow(1300, canvas_height/2);
                        }
                    }
                }
            }
        }

        let prev_code_shift = this.code_shift;
        if (mouse.check(this)) {
            if (mouse.x >= this.code_block_start_x && mouse.x <= this.code_block_start_x + this.code_block_width) {
                this.code_shift += mouse.scroll;
            }
            if (mouse.x >= this.box.x + this.box.width + this.box.depth) {
                this.mem.scroll(-mouse.scroll);
            }
        }

        let size = this.code.length * this.code_block_height;
        let max_code_height = 0;
        let min_code_height = Math.min(0, this.code_block_height - size);
        if (this.code_shift < min_code_height) {
            this.code_shift = min_code_height;
        } else if (this.code_shift > max_code_height) {
            this.code_shift = max_code_height;
        }
        for (let i = this.code.length-1; i >= 0; i--) {
            this.code[i].shift(this.code_shift - prev_code_shift);
            this.code[i].update(time, undefined, this.editable);
            if (this.code[i].drag === 1) {
                if (i === this.animating) {
                    this.animating = null;
                }
                this.selected = this.code[i];
                this.code.splice(i, 1);
                for (let j = i; i < this.code.length; i++) {
                    this.code[j].goto(this.code_block_start_x+8, 30 + (j+0.5)*this.code_block_height + this.code_shift);
                }
            }
        }
        this.box.shift(this.code_shift - prev_code_shift);

        if (this.selected !== null) {
            this.selected.update(time);
            if (this.editable && mouse.x >= this.code_block_start_x && mouse.x <= this.code_block_start_x + this.code_block_width) {
                const i = Math.floor((mouse.y - 10 - this.code_shift) / this.code_block_height);
                if (i >= 0 && i <= this.code.length) {
                    this.selected_block = i;
                }
            }
            if (this.selected.drag === 2) {
                if (this.selected_block !== null) {
                    this.selected.goto(this.code_block_start_x+this.selected.spacing, 30 + (this.selected_block+0.5)*this.code_block_height + this.code_shift);
                    this.code.splice(this.selected_block, 0, this.selected);
                    this.animating = this.selected_block;
                } else {
                    this.to_remove.push(this.selected);
                }
                if (this.commands.length < 7) {
                    this.commands.push(new Command(this.selected.text, this.selected.parameter, this.selected.colour, this.selected.width, this.selected.x));
                }
                this.selected = null;
            }
        }

        if (old_block !== this.selected_block) {
            if (old_block === null) {
                for (let i = this.selected_block; i < this.code.length; i++) {
                    this.code[i].goto(this.code_block_start_x+8, 30 + (i+1.5)*this.code_block_height + this.code_shift);
                }
            } else if (this.selected_block === null) {
                for (let i = old_block; i < this.code.length; i++) {
                    this.code[i].goto(this.code_block_start_x+8, 30 + (i+0.5)*this.code_block_height + this.code_shift);
                }
            } else if (old_block < this.selected_block) {
                for (let i = old_block; i < this.selected_block; i++) {
                    this.code[i].goto(this.code_block_start_x+8, 30 + (i+0.5)*this.code_block_height + this.code_shift);
                }
            } else if (this.selected_block < old_block) {
                for (let i = this.selected_block; i < old_block; i++) {
                    this.code[i].goto(this.code_block_start_x+8, 30 + (i+1.5)*this.code_block_height + this.code_shift);
                }
            }
        }

        if (this.animating !== null && this.code[this.animating].move_time >= this.code[this.animating].move_duration) {
            this.animating = null;
        }

        for (let i = this.to_remove.length-1; i >= 0; i--) {
            this.to_remove[i].update(time);
            if (this.to_remove[i].done) {
                this.to_remove.splice(i, 1);
            }
        }

        this.box.update();
        if (this.box.i >= 0 && this.box.i < this.code.length) {
            if (this.box.fast_button.click) {
                this.auto = true;
                this.speed = 3;
            }

            if ((this.auto || this.box.step_button.click) && this.box.move_timer === 0 && this.animation === null) {
                if (!this.prog_running) {
                    if (this.compiler === null) {
                        this.start_running();
                    } else {
                        this.compiler.set_up();
                        this.compiler.solve();
                    }
                    this.compile();
                    this.prog_running = true;
                    this.editable = false;
                }
                if (this.pointers.length > 0) {
                    this.animations = this.pointers[0];
                    this.pointers.splice(0, 1);
                    
                    this.animation = this.make_animation(this.animations[0]);
                    this.animation.initiate();
                    this.animations.splice(0, 1);
                }
            }
        }
        if (this.box.x_button.click && this.box.move_timer === 0 && this.animations.length === 0) {
            this.stop_running();
            for (let c of this.code) {
                this.to_remove.push(c);
                c.drag = 2;
                for (let p of c.particles) {
                    p.x += Math.random()*6 - 3;
                    p.y += Math.random()*6 - 3;

                }
            }
            this.code = [];
            this.editable = true;
            this.box.advance(-this.box.i*this.code_block_height-this.code_shift);
            this.code_shift = 0;
            this.prog.reset_total();
            this.reset();
        }

        if (this.box.reset_button.click && this.box.move_timer === 0 && this.animations.length === 0) {
            this.stop_running();
            this.editable = true;
            this.box.advance(-this.box.i*this.code_block_height);
            this.prog.reset();
            this.reset();
        }

        this.mem.update(this.editable);

        if (this.window !== null) {
            this.window.update();
            if (this.window.done) {
                this.window = null;
                this.box.advance(-this.box.i*this.code_block_height);
                this.prog.reset();
                this.reset();
            }
        }
    }

    update(time) {
        for (let i = 0; i < this.speed; i++) {
            this.update_actual(time / this.speed);
        }
    }

    reset() {
        this.animations = [];
        this.pointers = [];
        this.box.i = 0;
        this.mem.reset();
        this.prog_running = false;
    }

    start_running() {
        let comms = [];
        for (let c of this.code) {
            const name = c.text;
            let val = undefined;
            if (c.parameter && c.box.value !== null) {
                val = c.box.value;
            }

            comms.push({name:name, val:val});
        }
        this.compiler = new Compiler(comms, this.prog.get_input());
        this.compiler.solve();
    }

    stop_running() {
        this.compiler = null;
    }

    resize(old_width) {
        if (old_width !== canvas_width) {
            this.mem.resize(old_width);
        }
    }
}


let update = function(time) {
    ghostliness.update();

    control.update(time);
    
    mouse.update(time);
}

class Mouse {
    constructor() {
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.prev_x = 0;
        this.prev_y = 0;
        this.scroll = 0;

        this.click = 0;
        this.owner = null;
    }

    claim(from) {
        if (this.owner === null) {
            this.owner = from;
        }
    }

    unclaim(from) {
        if (this.owner === from) {
            this.owner = null;
        }
    }

    check(from) {
        if (!this.active) {
            return false;
        }
        return (this.owner === null || from === this.owner);
    }

    set_pos(x, y) {
        this.active = true;
        this.x = x / scale;
        this.y = y / scale;
    }

    update(time) {
        this.prev_x = this.x;
        this.prev_y = this.y;
        if (this.click === 2) {
            this.click = 1;
        } else if (this.click === -1) {
            this.click = 0;
        }
        this.scroll = 0;
    }
}

let mouse = new Mouse();

let control = new Control();
let ghostliness = new Ghostliness();
let draw = function(){
    ctx.save();
    ctx.scale(scale, scale);
    ctx.clearRect(0,0,canvas_width, canvas_height);
    ghostliness.predraw();
    ctx.clearRect(0,0,canvas_width, canvas_height);
	control.draw();
    ghostliness.draw();
    control.mem.clock.draw();
    ctx.restore();
}

let current_time = new Date().getTime();
let loop = function() {
    const time_step = 1000 / 60;

	let date = new Date();
	let new_time = date.getTime();
	time_change += (new_time - current_time);
	current_time = new_time;

	let update_steps = 0;
	while (time_change >= time_step) {
		update(time_step / 1000);
		time_change -= time_step;

		update_steps++;
		if (update_steps >= 240) {
			time_change = 0;
		}
	}

	if (update_steps > 0) {
		draw();
	}
	requestAnimationFrame(loop);
}

let mouse_move = function(e){
    let rect = canvas.getBoundingClientRect();
    mouse.set_pos(event.clientX - rect.left, event.clientY - rect.top);
}

let mouse_down = function(e) {
    mouse.click = 2;
}

let mouse_up = function(e) {
    mouse.click = -1;
}

let wheel = function(e) {
    if (e.deltaY > 0) {
        mouse.scroll = -50;
    } else if (e.deltaY < 0) {
        mouse.scroll = 50;
    }
}

let init = function() {
	document.addEventListener('mousemove', mouse_move)
	document.addEventListener('mousedown', mouse_down)
	document.addEventListener('mouseup',   mouse_up)
    document.addEventListener('wheel',     wheel)

	time_change = 0
	let date = new Date()
	current_time = date.getTime()
	loop()
}

let resize = function() {
    const old_width = canvas_width;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (canvas.width < min_canvas_width) {
        scale = canvas.width / canvas_width;
        canvas_width = min_canvas_width;
    } else {
        scale = 1;
        canvas_width = canvas.width;
    }
    canvas_height = canvas.height / scale

    other_canvas.width = canvas.width;
    other_canvas.height = canvas.height;

    control.resize(old_width);
}

window.onload = function() {
    resize();
    window.onresize = resize;
	init()
}