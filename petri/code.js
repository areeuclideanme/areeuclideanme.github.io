let canvas = document.getElementById('canvas')
let ctx = canvas.getContext('2d')

const TIME_STEP = 1000 / 30
let time_change
let current_time

let animator

let line_intersection = function(x1, y1, x2, y2, x3, y3, x4, y4) {
	let det = (x1-x2) * (y3-y4) - (y1-y2) * (x3-x4)
	let t1 = ((x1-x3) * (y3-y4) - (y1-y3) * (x3-x4)) / det
	let t2 = ((x1-x3) * (y1-y2) - (y1-y3) * (x1-x2))  / det
	if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
		let x = x1 + (x2 - x1) * t1
		let y = y1 + (y2 - y1) * t1
		return {x:x, y:y}
	} else {
		return null
	}
}

let mod = function(a,n) {
	return ((a % n) + n) % n
}

let smooth_step = function(t) {
	return 3*t*t - 2*t*t*t
}

let linear = function(t) {
	return t
}

let quadratic = function(t) {
	return t*t
}

class Animator {
	constructor() {
		this.animations = []
	}

	animate(thing, property, value, time, delay, animation) {
		if (delay === undefined) {
			delay = 0
		}
		if (animation === undefined) {
			animation = smooth_step
		}
		this.animations.push({thing:thing, property:property, end:value, t:-delay, duration:time, animation:animation})
	}

	update(time) {
		for (let i = this.animations.length-1; i >= 0; i--) {
			let a = this.animations[i]
			a.t += time
			if (a.t >= 0) {
				if (a.start === undefined) {
					a.start = a.thing[a.property]
				}
				if (a.t >= a.duration) {
					a.t = a.duration
					this.animations.splice(i,1)
					a.thing[a.property] = a.end
				} else {
					let val = a.animation(a.t / a.duration)
					a.thing[a.property] = a.start*(1-val) + a.end*val
				}
			}
		}
	}
}

class Particle {
	constructor(x, y) {
		this.x = x
		this.y = y
		this.vx = 0
		this.vy = 0
		this.ax = 0
		this.ay = 0
		this.posns = [x,y]
	}

	dist_squared(x, y) {
		let dx = x - this.x
		let dy = y - this.y
		return dx*dx + dy*dy
	}

	attract(x,y,r,strength) {
		let dx = x - this.x
		let dy = y - this.y
		let len = Math.sqrt(dx*dx+dy*dy)
		if (len > 0 && len < r) {
			this.ax += dx*strength*(1-len/r)*0.1
			this.ay += dy*strength*(1-len/r)*0.1
		}
	}

	attract_square(x,y,r,strength) {
		let dx = x - this.x
		let dy = y - this.y
		let len = Math.sqrt(dx*dx+dy*dy)
		if (len > 0 && Math.abs(dx) < r && Math.abs(dy) < r) {
			this.ax += dx*strength*(1-len/r/1.5)*0.1
			this.ay += dy*strength*(1-len/r/1.5)*0.1
		}
	}

	update() {
		this.ax -= this.vx*1
		this.ay -= this.vy*1
		this.vx += this.ax
		this.vy += this.ay
		this.ax = 0
		this.ay = 0
		this.x += this.vx
		this.y += this.vy

		this.posns.push(this.x)
		this.posns.push(this.y)
		if (this.posns.length > 10*2) {
			this.posns.splice(0,1)
			this.posns.splice(0,1)
		}
	}

	get() {
		let x = 0
		let y = 0
		for (let i = 0; i < this.posns.length; i += 2) {
			x += this.posns[i]
			y += this.posns[i+1]
		}
		x = x / (this.posns.length/2)
		y = y / (this.posns.length/2)
		return {x:x, y:y}
	}

	draw() {
		let pt = this.get()
		ctx.beginPath()
		ctx.arc(pt.x, pt.y, 5, 0, 2*Math.PI)
		ctx.fill()
	}
}


class Critter {
	constructor(particles, magnets, left, right, up, down) {
		this.particles = particles
		this.magnets = magnets
		this.bounds = {l:left, r:right, u:up, d:down}
		this.amount = 60
		this.r = 40
		this.outline = []

		this.face = this.get_centre()
		this.face_scaling = true

		this.shell_delay = -1
		this.shell = false
		this.scale = 0
		this.die_timer = -1
		this.max_die_timer = 0.7+Math.random()*0.5
		this.donezo = false
	}

	get_centre() {
		let centre_x = (this.bounds.l + this.bounds.r)/2
		let centre_y = (this.bounds.u + this.bounds.d)/2
		return {x:centre_x, y:centre_y}
	}

	draw_path(path) {
		ctx.beginPath()
		let start_x = (path[path.length-4] + path[path.length-2])/2
		let start_y = (path[path.length-3] + path[path.length-1])/2
		ctx.moveTo(start_x, start_y)
		for (let i = 2; i < path.length; i+= 2) {
			let prev_x = path[i-2]
			let prev_y = path[i-1]
			let next_x = path[i]
			let next_y = path[i+1]
			let mid_x = (prev_x + next_x)/2
			let mid_y = (prev_y + next_y)/2
			ctx.quadraticCurveTo(prev_x,prev_y,mid_x,mid_y)
		}
	}

	draw_critters(critters) {
		for (let c of critters) {
			this.draw_path(c)
			ctx.fillStyle = '#FF699E'
			ctx.fill()
			ctx.lineWidth = 5
			ctx.strokeStyle = '#781639'
			ctx.stroke()
		}
	}

	find_outline() {
		let r = this.r
		let coords = []
		for (let p of this.particles) {
			let pt = p.get()
			coords.push([pt.x,pt.y])
		}

		let edges = []

		let delaunay = Delaunator.from(coords)
		let boundary = []
		let found = []
		for (let e = 0; e < delaunay.triangles.length; e++) {
			if (delaunay.halfedges[e] === -1) {
				boundary.push(e)
			}
			found.push(false)
		}

		while (boundary.length > 0) {
			let e = boundary.pop()
			found[e] = true
			let next_e
			if (e % 3 === 2) {
				next_e = e-2
			} else {
				next_e = e+1
			}
			let prev_e
			if (e % 3 === 0) {
				prev_e = e + 2
			} else {
				prev_e = e-1
			}
			let p = coords[delaunay.triangles[e]];
            let q = coords[delaunay.triangles[next_e]];
            let dx = q[0] - p[0]
            let dy = q[1] - p[1]
            if (dx*dx + dy*dy < r*r) {
            	edges.push([delaunay.triangles[e],delaunay.triangles[next_e]])
            } else {
            	let next = delaunay.halfedges[next_e]
            	let prev = delaunay.halfedges[prev_e]
            	
            	if (next >= 0 && !found[next]) {
			    	boundary.push(next)
            	}

            	if (prev >= 0 && !found[prev]) {
            		boundary.push(prev)
            	}
            }
		}

		let critters = []
		let boundary_verts = []
		let c = []
		while (edges.length > 0) {
			let found = false
			for (let i = 0; i < edges.length; i++) {
				if (c.length === 0) {
					c.push(edges[i][0])
					c.push(edges[i][1])
					edges.splice(i,1)
					found = true
					break
				} else if (edges[i][0] === c[c.length-1]) {
					c.push(edges[i][1])
					edges.splice(i,1)
					found = true
					break
				} else if (edges[i][1] === c[c.length-1]) {
					c.push(edges[i][0])
					edges.splice(i,1)
					found = true
					break
				}
			}
			if (!found) {
				c = []
			}
			if (c.length > 1 && c[c.length-1] === c[0]) {
				let result = []
				for (let i = 0; i < c.length; i++) {
					boundary_verts.push(c[i])
					let pt = coords[c[i]]
					result.push(pt[0])
					result.push(pt[1])
				}
				critters.push(result)
				c = []
			}
		}
		this.outline = critters

		if (this.shell && this.shell_delay <= 0) {
			if (this.outline.length === 0) {
				this.particles = []
			} else {
				for (let v of boundary_verts) {
					if (Math.random() < 0.4) { 
						this.particles.splice(v,1)
					}
				}
			}
		}
	}

	draw_face(x,y) {
		let size = this.bounds.r - this.bounds.l
		ctx.beginPath()
		ctx.arc(x-size/8,y,5,0,2*Math.PI)
		ctx.fill()
		ctx.beginPath()
		ctx.arc(x+size/8,y,5,0,2*Math.PI)
		ctx.fill()
		ctx.lineWidth = 5
		ctx.lineCap = 'round'
		ctx.beginPath()
		ctx.moveTo(x-size/12,y+size/8)
		ctx.bezierCurveTo(x-size/20,y+size/6,x+size/20,y+size/6,x+size/12,y+size/8)
		ctx.stroke()
	}

	draw_shell() {
		let pt = this.get_centre()
		let size = this.bounds.r - this.bounds.l
		ctx.lineWidth = 5
		ctx.strokeStyle = '#303030'
		ctx.fillStyle = '#505050'
		ctx.beginPath()
		ctx.arc(pt.x,pt.y,this.scale*size*2/5,0,2*Math.PI)
		ctx.fill()	
		ctx.stroke()

		ctx.fillStyle = '#303030'
		ctx.save()
		ctx.translate(pt.x,pt.y)
		ctx.scale(this.scale,this.scale)
		this.draw_face(0,0)
		ctx.restore()
	}

	draw() {
		if (this.shell && this.shell_delay <= 0) {
			this.draw_shell()
		}
		if (this.particles.length > 0) {
			this.draw_critters(this.outline)
			
			let scale = 1
			if (this.face_scaling) {
				scale = this.particles.length / this.amount
			}
			ctx.save()
			ctx.translate(this.face.x, this.face.y)
			ctx.scale(scale,scale)
			ctx.fillStyle = '#781639'
			ctx.strokeStyle = '#781639'
			this.draw_face(0,0)
			ctx.restore()
		}
	}

	update(time) {
		if (!this.shell || this.shell_delay > 0) {
			if (this.particles.length < this.amount) {
				let centre = this.get_centre()
				let size = this.bounds.r - this.bounds.l
				for (let i = 0; i < 3; i++) {
					this.particles.push(new Particle(centre.x+Math.random()*size/5-size/10, centre.y+Math.random()*size/5-size/10))
				}
			} else {
				this.face_scaling = false
				while (this.particles.length > this.amount) {
					this.particles.pop()
				}
			}

			if (this.magnets.length === 0) {
				let centre = this.get_centre()
				this.magnets.push({x:centre.x, y:centre.y, s:1})
			}
		} else {
			if (this.scale < 1) {
				let val = this.particles.length / this.amount
				if (val > 1) {
					val = 1
				}
				this.scale = 1-smooth_step(val)
			}
		}

		for (let p1 of this.particles) {
			for (let p2 of this.particles) {
				p1.attract(p2.x, p2.y, 22, -3)	
			}
			for (let m of this.magnets) {
				let width = (this.bounds.r - this.bounds.l)/2
				p1.attract_square(m.x, m.y, width, m.s)
			}
		}

		for (let p of this.particles) {
			p.update()
		}

		if (this.shell_delay > 0) {
			this.shell_delay -= time
		}

		if (this.die_timer > 0) {
			this.die_timer -= time
			if (this.die_timer < 0) {
				this.die_timer = 0
			}
			this.scale = smooth_step(this.die_timer/this.max_die_timer)
			if (this.die_timer <= 0) {
				this.donezo = true
			}
		}
		
		if (this.particles.length > 0) {
			this.find_outline()
			let pt = {x:0, y:0}
			for (let p of this.particles) {
				pt.x += p.x
				pt.y += p.y
			}
			pt.x /= this.particles.length
			pt.y /= this.particles.length

			let centre = this.get_centre()
			pt.x = (pt.x + centre.x)/2
			pt.y = (pt.y + centre.y)/2

			this.face.x += (pt.x - this.face.x)*0.1
			this.face.y += (pt.y - this.face.y)*0.1
		}
	}

	get_l() {
		let result = []
		for (let i = this.particles.length-1; i>= 0; i--) {
			let p = this.particles[i]
			if (p.x < this.bounds.l) {
				this.particles.splice(i,1)
				result.push(p)
			}
		}
		return result
	}

	get_r() {
		let result = []
		for (let i = this.particles.length-1; i>= 0; i--) {
			let p = this.particles[i]
			if (p.x > this.bounds.r) {
				this.particles.splice(i,1)
				result.push(p)
			}
		}
		return result
	}

	get_u() {
		let result = []
		for (let i = this.particles.length-1; i>= 0; i--) {
			let p = this.particles[i]
			if (p.y < this.bounds.u) {
				this.particles.splice(i,1)
				result.push(p)
			}
		}
		return result
	}

	get_d() {
		let result = []
		for (let i = this.particles.length-1; i>= 0; i--) {
			let p = this.particles[i]
			if (p.y > this.bounds.d) {
				this.particles.splice(i,1)
				result.push(p)
			}
		}
		return result
	}

	print_particles() {
		let result = []
		let centre = this.get_centre()
		for (let p of this.particles) {
			result.push(p.x-centre.x)
			result.push(p.y-centre.y)
		}
		return result
	}

	finish_split() {
		this.magnets.pop()
	}

	start_shell() {
		this.shell_delay = 1.5
		this.shell = true
	}

	make_shell() {
		this.particles = []
		this.magnets = []
		this.outline = []
		this.shell = true
		this.scale = 1
	}

	disintegrate() {
		this.die_timer = this.max_die_timer
	}

	split(dir) {
		let start_pt = this.get_centre()
		let end_pt = {x:start_pt.x, y:start_pt.y}
		let size = this.bounds.r - this.bounds.l
		if (dir === 'l') {
			end_pt.x -= size
		} else if (dir === 'r') {
			end_pt.x += size
		} else if (dir === 'u') {
			end_pt.y -= size
		} else if (dir === 'd') {
			end_pt.y += size
		}

		let t = 0.4
		let magnet = {x:start_pt.x*(1-t)+end_pt.x*t, y:start_pt.y*(1-t)+end_pt.y*t, s:2.5}
		animator.animate(magnet, 'x', end_pt.x, 1)
		animator.animate(magnet, 'y', end_pt.y, 1)
		animator.animate(magnet, 's', 1, 0.5, 1)

		this.magnets.push(magnet)
	}
}

class Button {
	constructor(x,y) {
		this.x = x
		this.y = y
		this.sizes = [120,125,115,100]
		this.colours = ['#D0D0F0', '#D8D8F8', '#C8C8E8','#A0A0C0']
		this.corner_r = 10
		this.state = 0
		this.click = false
	}

	draw_icon() {}

	draw() {
		let size = this.sizes[this.state]
		ctx.lineWidth = 5
		ctx.strokeStyle = '#000000'
		ctx.beginPath()
		let left = this.x - size/2 + this.corner_r
		let top = this.y - size/2 + this.corner_r
		let right = this.x + size/2 - this.corner_r
		let bottom = this.y + size/2 - this.corner_r
		ctx.arc(left, top, this.corner_r, Math.PI, 3*Math.PI/2)
		ctx.arc(right, top, this.corner_r, -Math.PI/2, 0)
		ctx.arc(right, bottom, this.corner_r, 0, Math.PI/2)
		ctx.arc(left, bottom, this.corner_r, Math.PI/2, Math.PI)
		ctx.closePath()
		ctx.fillStyle = this.colours[this.state]
		ctx.fill()
		ctx.stroke()
		this.draw_icon()
	}

	update(time,m) {
		this.click = false
		if (this.state === 0) {
			if (m.click === 0 && m.x >= this.x - this.sizes[1]/2 && m.x <= this.x + this.sizes[1]/2 && m.y >= this.y - this.sizes[1]/2 && m.y <= this.y + this.sizes[1]/2) {
				this.state = 1 
			}
		} else if ((m.x < this.x - this.sizes[1]/2 || m.x > this.x + this.sizes[1]/2 || m.y < this.y - this.sizes[1]/2 || m.y > this.y + this.sizes[1]/2) && this.state !== 3) {
			this.state = 0
		} else if (this.state === 1) {
			if (m.click === 2) {
				this.state = 2
			}
		} else if (this.state === 2) {
			if (m.click === -1) {
				this.state = 1
				this.click = true
			}
		}
	}

	disable() {
		this.state = 3
	}

	enable() {
		this.state = 0
	}
}

class StepButton extends Button {
	draw_icon() {
		let size = this.sizes[this.state]
		ctx.lineCap = 'round'
		let vecx = -0.45
		let vecy = -0.75
		let aclockx = 0.707*vecx - 0.707*vecy
		let aclocky = 0.707*vecx + 0.707*vecy
		let clockx = 0.707*vecx + 0.707*vecy
		let clocky = -0.707*vecx + 0.707*vecy
		ctx.lineWidth  = 15
		ctx.strokeStyle = '#000000'
		ctx.beginPath()
		ctx.moveTo(this.x - size/3, this.y + size/10)
		ctx.bezierCurveTo(this.x - size/5, this.y - size/4, this.x + size/5, this.y - size/4, this.x + size/3, this.y + size/10)
		ctx.moveTo(this.x + size/3 + size/6*aclockx, this.y + size/10 + size/6*aclocky)
		ctx.lineTo(this.x + size/3, this.y + size/10)
		ctx.lineTo(this.x + size/3 + size/6*clockx, this.y + size/10 + size/6*clocky)
		ctx.stroke()
		ctx.lineWidth  = 5
		ctx.strokeStyle = '#FFFFFF'
		ctx.stroke()
	}
}

class RestartButton extends Button {
	draw_icon() {
		let size = this.sizes[this.state]
		ctx.lineCap = 'round'
		ctx.beginPath()
		ctx.arc(this.x, this.y, size/4, -Math.PI/2, Math.PI*5/4)
		let vecx = 0.9
		let vecy = 0.3
		let aclockx = 0.707*vecx - 0.707*vecy
		let aclocky = 0.707*vecx + 0.707*vecy
		let clockx = 0.707*vecx + 0.707*vecy
		let clocky = -0.707*vecx + 0.707*vecy
		ctx.moveTo(this.x+size/6*aclockx,this.y-size/4+size/6*aclocky)
		ctx.lineTo(this.x,this.y-size/4)
		ctx.lineTo(this.x+size/6*clockx,this.y-size/4+size/6*clocky)
		ctx.lineWidth = 15
		ctx.strokeStyle = '#000000'
		ctx.stroke()
		ctx.lineWidth=5
		ctx.strokeStyle = '#FFFFFF'
		ctx.stroke()
	}
}

class PlayButton extends Button {
	constructor(x,y) {
		super(x,y)
		this.draw_icon = this.draw_play
		this.playing = 0
	}

	draw_play() {
		let size = this.sizes[this.state]
		ctx.lineCap = 'round'
		ctx.beginPath()
		ctx.moveTo(this.x-size/7, this.y-0.5*size*3/8)
		ctx.lineTo(this.x+size/4, this.y)
		ctx.lineTo(this.x-size/7, this.y+0.5*size*3/8)
		ctx.closePath()
		ctx.lineWidth=5
		ctx.strokeStyle = '#000000'
		ctx.fillStyle = '#FFFFFF'
		ctx.fill()
		ctx.beginPath()
		ctx.moveTo(this.x-size/7, this.y-0.5*size*3/8)
		ctx.lineTo(this.x+size/4, this.y)
		ctx.stroke()
		ctx.beginPath()
		ctx.moveTo(this.x+size/4, this.y)
		ctx.lineTo(this.x-size/7, this.y+0.5*size*3/8)
		ctx.stroke()
		ctx.beginPath()
		ctx.moveTo(this.x-size/7, this.y-0.5*size*3/8)
		ctx.lineTo(this.x-size/7, this.y+0.5*size*3/8)
		ctx.stroke()
	}

	draw_pause() {
		let size = this.sizes[this.state]
		ctx.lineCap = 'round'
		ctx.beginPath()
		ctx.moveTo(this.x-size/10,this.y-size/6)
		ctx.lineTo(this.x-size/10,this.y+size/6)
		ctx.lineWidth = 15
		ctx.strokeStyle = '#000000'
		ctx.stroke()
		ctx.lineWidth = 5
		ctx.strokeStyle = '#FFFFFF'
		ctx.stroke()
		ctx.beginPath()
		ctx.moveTo(this.x+size/10,this.y-size/6)
		ctx.lineTo(this.x+size/10,this.y+size/6)
		ctx.lineWidth = 15
		ctx.strokeStyle = '#000000'
		ctx.stroke()
		ctx.lineWidth = 5
		ctx.strokeStyle = '#FFFFFF'
		ctx.stroke()
	}

	update(time,m) {
		super.update(time,m)
		if (this.click) {
			if (this.playing === 0) {
				this.draw_icon = this.draw_pause
				this.playing = 1
			} else {
				this.draw_icon = this.draw_play
				this.playing = 0
			}
		}
	}
}


class Colony {
	constructor(size, spacing) {
		this.size = size
		this.spacing = spacing
		
		this.ox = canvas.width/2
		this.oy = canvas.height/2
		this.shiftx = 0
		this.shifty = 0

		this.critters = {}
		this.splits = []
		this.disintegraters = []

		this.costs = {}
		this.costs_set = false
		this.to_remove_costs = []

		this.defaults = []
		for (let i = 0; i < 4; i++) {
			let default_critter = new Critter([],[],-(this.size+this.spacing)/2,(this.size+this.spacing)/2,-(this.size+this.spacing)/2,(this.size+this.spacing)/2)
			for (let j = 0; j < 120; j++) {
				default_critter.update()
			}
			this.defaults.push(default_critter.print_particles())
		}
		this.set_screen()

		this.drag_start = null
		this.animate_timer = 0

		this.buttons = [new PlayButton(70,canvas.height-70), new StepButton(210, canvas.height - 70), new RestartButton(350, canvas.height - 70)]
		this.button_fs = ['toggle', 'step', 'clear']

		this.playing = false
		this.map    = {}
	}

	resize() {
		for (let b of this.buttons) {
			b.y = canvas.height-70
		}
	}

	get_cell(x, y) {
		let col = Math.floor((x-(this.ox+this.shiftx - this.size/2)) / (this.size+this.spacing))
		let row = Math.floor((y-(this.oy+this.shifty - this.size/2)) / (this.size+this.spacing))
		return {x:col,y:row}
	}

	set_screen() {
		let l = Math.floor(-(this.ox+this.shiftx - this.size/2) / (this.size+this.spacing))-1
		let r = Math.floor((canvas.width-(this.ox+this.shiftx - this.size/2)) / (this.size+this.spacing)) + 1
		let u = Math.floor(-(this.oy+this.shifty - this.size/2) / (this.size+this.spacing))-1
		let d = Math.floor((canvas.height-(this.oy+this.shifty - this.size/2)) / (this.size+this.spacing)) + 1
		this.screen = {l:l, r:r, u:u, d:d}
	}

	get_default_particles(x,y) {
		let particles = []
		let pt = this.get_pt(x,y)
		let coords = this.defaults[Math.floor(Math.random()*this.defaults.length)]
		for (let i = 0; i < coords.length; i+=2) {
			particles.push(new Particle(coords[i]+pt.x, coords[i+1]+pt.y))
		}
		return particles
	}

	on_screen(x, y) {
		return x >= this.screen.l && x <= this.screen.r && y >= this.screen.u && y <= this.screen.d
	}

	add_critter(x, y, particles, magnets) {
		if (!this.on_screen(x,y)) {
			particles = this.get_default_particles(x,y)
		}
		let pt = this.get_pt(x,y)
		let radius = (this.size + this.spacing)/2
		this.critters[x+','+y] = new Critter(particles, magnets, pt.x-radius,pt.x+radius,pt.y-radius,pt.y+radius)
	}

	disintegrate(x, y) {
		let coord = x+','+y
		let critter = this.critters[coord]
		if (this.on_screen(x,y)) {
			critter.disintegrate()
		}
		critter.state = 0
		this.disintegraters.push({x:x,y:y})
	}

	split(from_x, from_y, to_x, to_y) {
		if (this.on_screen(from_x,from_y) && this.on_screen(to_x,to_y)) {
			let dx = to_x - from_x
			let dy = to_y - from_y
			let dir
			if (dx === -1 && dy === 0) {
				dir = 'l'
			} else if (dx === 1 && dy === 0) {
				dir = 'r'
			} else if (dx === 0 && dy === -1) {
				dir = 'u'
			} else if (dx === 0 && dy === 1) {
				dir = 'd'
			}
			this.critters[from_x+','+from_y].split(dir)
			this.splits.push({dir:dir, xi:from_x, yi: from_y, xf:to_x, yf:to_y, t:1})
		} else {
			this.add_critter(to_x,to_y,[],[])
			let critter = this.critters[from_x+','+from_y]
			if (critter !== undefined) {
				critter.particles = []
			}
		}
	}

	finish_split(from_x, from_y, to_x, to_y, dir) {
		if (this.on_screen(from_x,from_y) && this.on_screen(to_x,to_y)) {
			let critter = this.critters[from_x+','+from_y]
			let new_particles = critter['get_'+dir]()
			critter.finish_split()
			this.add_critter(to_x,to_y,new_particles,[])
		} else {
			this.add_critter(to_x,to_y,[],[])
		}
	}

	shellify(x,y) {
		let critter = this.critters[x+','+y]
		if (this.on_screen(x,y)) {
			critter.start_shell(x,y)
		} else {
			critter.make_shell(x,y)
		}
	}

	get_pt(x, y) {
		return {x:this.ox+x*(this.size+this.spacing), y:this.oy+y*(this.size+this.spacing)}
	}

	toggle() {
		this.playing = !this.playing
		if (this.playing) {
			this.buttons[1].disable()
			this.buttons[2].disable()
		} else {
			this.buttons[1].enable()
			this.buttons[2].enable()
		}
	}

	clear() {
		for (let coord in this.critters) {
			delete this.critters[coord]
		}
		this.disintegraters = []
		this.splits = []
		this.map = {}
		this.arrows = {}
		this.costs = {}
	}

	step() {
		if (this.animate_timer <= 0) {
			let coords = []
			for (let coord in this.critters) {
				coords.push(coord)
			}

			let changes = {}
			for (let coord of coords) {
				let split_coord = coord.split(',')
				let x = parseInt(split_coord[0])
				let y = parseInt(split_coord[1])
				let critter = this.critters[coord]
				let neighbours = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]
				if (critter.shell) {
					this.disintegrate(x,y)
					delete this.map[x+','+y]
				} else {
					for (let n of neighbours) {
						let n_coord = n[0]+','+n[1]
						if (this.critters[n_coord] === undefined) {
							this.split(x,y,n[0],n[1])
							this.map[n_coord] = 1
						}
					}
					this.shellify(x,y)
					this.map[x+','+y] = 2
				}
			}
			this.animate_timer = 2
		}
	}

	highlight(x,y) {
		let pts = []
		let theta = Math.random()*2*Math.PI
		let centre = this.get_pt(x,y)
		for (let i = 0; i <= 15; i++) {
			let angle = theta + 2*Math.PI*i/15
			let pt_x = (this.size+this.spacing)/2*Math.cos(angle) + centre.x + Math.random()*4 - 2
			let pt_y = (this.size+this.spacing)/2*Math.sin(angle) + centre.y + Math.random()*4 - 2
			pts.push(pt_x)
			pts.push(pt_y)
		}
		this.highlights[x+','+y] = new Move(pts,1000)
	}

	unhighlight(x,y) {
		delete this.highlights[x+','+y]
	}

	update(time) {
		this.set_screen()

		let m = mouse

		let mouse_available = true
		for (let i = 0; i < this.buttons.length; i++) {
			this.buttons[i].update(time,m)
			if (this.buttons[i].state === 1 || this.buttons[i].state === 2) {
				mouse_available = false
			}
			if (this.buttons[i].click) {
				this[this.button_fs[i]]()
			}
		}

		for (let y = this.screen.u; y <= this.screen.d; y++) {
			for (let x = this.screen.l; x <= this.screen.r; x++) {
				let critter = this.critters[x+','+y]
				if (critter !== undefined) {
					critter.update(time)
				}
			}
		}

		for (let i = this.disintegraters.length-1; i >= 0; i--) {
			let cell = this.disintegraters[i]
			if (!this.on_screen(cell.x,cell.y) || (this.critters[cell.x+','+cell.y] !== undefined && this.critters[cell.x+','+cell.y].donezo)) {
				delete this.critters[cell.x+','+cell.y]
				this.disintegraters.splice(i,1)
			}
		}

		for (let i = this.splits.length-1; i >= 0; i--) {
			this.splits[i].t -= time
			if (this.splits[i].t <= 0) {
				this.finish_split(this.splits[i].xi,this.splits[i].yi,this.splits[i].xf,this.splits[i].yf,this.splits[i].dir)
				this.splits.splice(i,1)
			}
		}

		if (mouse_available && m.click === 2 && this.drag_start === null) {
			this.drag_start = {x:m.x, y:m.y, shiftx:this.shiftx, shifty:this.shifty, dragging:false}
		}
		if (this.drag_start !== null) {
			if (m.click <= 0) {
				if (!this.drag_start.dragging) {
					let x = Math.floor((mouse.x-(this.ox+this.shiftx - this.size/2)) / (this.size+this.spacing))
					let y = Math.floor((mouse.y-(this.oy+this.shifty - this.size/2)) / (this.size+this.spacing))	
					if (m.shift) {
						if (this.highlights[x+','+y] !== undefined) {
							this.unhighlight(x,y)
						} else {
							this.highlight(x,y)
						}
					} else  if (this.animate_timer <= 0 && !this.playing) {
						let critter = this.critters[x+','+y]
						if (critter === undefined) {
							this.add_critter(x,y,[],[])
							this.map[x+','+y] = 1
						} else if (!critter.shell) {
							critter.shell = true
							this.map[x+','+y] = 2
						} else if (critter.die_timer < 0) {
							delete this.map[x+','+y]
							this.disintegrate(x,y)
						}
					}
				}
				this.drag_start = null
			} else {
				if (!this.drag_start.dragging) {
					let dx = m.x - this.drag_start.x
					let dy = m.y - this.drag_start.y
					if (dx*dx + dy*dy > 25) {
						this.drag_start.dragging = true
					}
				} else {
					this.shiftx = this.drag_start.shiftx + m.x - this.drag_start.x
					this.shifty = this.drag_start.shifty + m.y - this.drag_start.y
				}
			}
		}

		if (this.animate_timer > 0) {
			this.animate_timer -= time
		} else if (this.playing) {
			this.step()
		}
	}

	draw() {
		ctx.save()
		ctx.translate(this.shiftx,this.shifty)
		for (let y = this.screen.u; y <= this.screen.d; y++) {
			for (let x = this.screen.l; x <= this.screen.r; x++) {
				let pt = this.get_pt(x,y)
				ctx.fillStyle = '#E0E0E0'
				ctx.fillRect(pt.x-this.size/2, pt.y-this.size/2, this.size, this.size)					
			}
		}

		for (let y = this.screen.u; y <= this.screen.d; y++) {
			for (let x = this.screen.l; x <= this.screen.r; x++) {
				let critter = this.critters[x+','+y]
				if (critter !== undefined) {
					critter.draw()
				}
			}
		}
		ctx.restore()

		for (let b of this.buttons) {
			b.draw()
		}
	}
}


animator = new Animator()
let frame = new Colony(100, 20)
let mouse = {x:0, y:0, click:0, shift:false}
let kb = {space:0}

let update = function(time) {
	animator.update(time)
	frame.update(time)

	if (mouse.click === 2) {
		mouse.click = 1
	} else if (mouse.click === -1) {
		mouse.click = 0
	}

	if (kb.space === 2) {
		kb.space = 1
	} else if (kb.space === -1) {
		kb.space = 0
	}
}

let draw = function(){
	ctx.clearRect(0,0,canvas.width,canvas.height)
	frame.draw()
}

let loop = function() {
	let date = new Date()
	let new_time = date.getTime()
	time_change += (new_time - current_time)
	current_time = new_time

	let update_steps = 0
	while (time_change >= TIME_STEP) {
		update(TIME_STEP / 1000)
		time_change -= TIME_STEP

		update_steps++
		if (update_steps >= 240) {
			time_change = 0
		}
	}

	if (update_steps > 0) {
		draw()
	}
	requestAnimationFrame(loop)
}

let mouse_move = function(e){
	let rect = canvas.getBoundingClientRect()
	mouse.x = (event.clientX - rect.left)
	mouse.y = (event.clientY - rect.top)
}

let mouse_down = function(e) {
	if (e.shiftKey) {
		mouse.shift = true
	} else {
		mouse.shift = false
	}
	mouse.click = 2
}

let mouse_up = function(e) {
	mouse.click = -1
}

let key_down = function(e) {
	if (e.key === ' ') {
		kb.space = 2
	}
}

let key_up = function(e) {
	if (e.key === ' ') {
		kb.space = -1
	}
}

let init = function() {
	document.addEventListener('mousemove', mouse_move)
	document.addEventListener('mousedown', mouse_down)
	document.addEventListener('mouseup',   mouse_up)
	document.addEventListener('keydown', key_down)
	document.addEventListener('keyup', key_up)

	resize()
	window.onresize = resize

	time_change = 0
	let date = new Date()
	current_time = date.getTime()
	loop()
}

var resize = function() {
	canvas.width = window.innerWidth
	canvas.height = window.innerHeight
	frame.resize()
}

window.onload = function() {
	init()
}