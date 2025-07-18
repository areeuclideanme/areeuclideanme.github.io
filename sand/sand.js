let canvas = document.getElementById('canvas')
let ctx = canvas.getContext('2d')

let wind_strength = 2;
let sheltering = true;
let shelter_angle = 1;
let avalanching = true;
let avalanche_threshhold = 3;
let playing = false;

let width = canvas.width;
let height = canvas.height;
let desert = [];
let setup_desert = function() {
	desert = []
	for (let y = 0; y < height; y++) {
		desert.push([])
		for (let x = 0; x < width; x++) {
			desert[y].push(4 + Math.floor(Math.random()*2))
		}
	}
}

setup_desert();

let avalanche = function(top_x,top_y,bot_x,bot_y, n) {
	if (!avalanching || n >= 10) {
		return false;
	}

	top_x = top_x % width
	if (top_x < 0) {
		top_x += width
	}
	bot_x = bot_x % width
	if (bot_x < 0) {
		bot_x += width
	}
	top_y = top_y % height
	if (top_y < 0) {
		top_y += height
	}
	bot_y = bot_y % height
	if (bot_y < 0) {
		bot_y += height
	}

	if (desert[top_y][top_x] - desert[bot_y][bot_x] >= avalanche_threshhold) {
		remove_grain(top_x,top_y,n+1)
		add_grain(bot_x,bot_y,n+1)
	}
}

let add_grain = function(x,y,n) {
	desert[y][x] += 1

	avalanche(x,y,x+1,y,n)
	avalanche(x,y,x-1,y,n)
	avalanche(x,y,x,y-1,n)
	avalanche(x,y,x,y+1,n)
}

let remove_grain = function(x,y,n) {
	desert[y][x] -= 1

	avalanche(x-1,y,x,y,n)
	avalanche(x+1,y,x,y,n)
	avalanche(x,y-1,x,y,n)
	avalanche(x,y+1,x,y,n)
}


let is_sheltered = function(x,y) {
	if (!sheltering) {
		return false;
	}

	let steps = 1
	while (steps < width) {
		let new_x = (x - steps) % width
		if (new_x < 0) {
			new_x += width
		}
		let height = desert[y][new_x] - desert[y][x]
		if (height * shelter_angle >= steps) {
			return true
		}
		steps += 1
	}
	return false
}


let blow_grain = function() {
	let x = Math.floor(Math.random()*width)
	let y = Math.floor(Math.random()*height)
	while (desert[y][x] === 0 || is_sheltered(x,y)) {
		x = Math.floor(Math.random()*width)
		y = Math.floor(Math.random()*height)
	}

	remove_grain(x,y,0)
	let new_x = (x + wind_strength) % width
	add_grain(new_x,y,0)
}


let draw = function() {
	if (playing) {
		for (let i = 0; i < 10000; i++) {
			blow_grain()
		}
	}

	let img = ctx.createImageData(width,height)
	
	let i = 0
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let brightness = desert[y][x] / 10
			if (brightness > 1) {
				brightness = 1
			}

			img.data[i] = 255 * brightness //red
			img.data[i+1] = 230 * brightness //green
			img.data[i+2] = 160 * brightness //blue
			img.data[i+3] = 255 //alpha

			i += 4
		}
	}

	ctx.putImageData(img,0,0)

	requestAnimationFrame(draw)
}

let set_wind = function(val) {
	wind_strength = parseInt(val);
	document.getElementById("windval").innerHTML = val;
}

let set_shelter = function(val) {
	shelter_angle = parseFloat(val);
	document.getElementById("shelterval").innerHTML = val;
}

let set_avalanche = function(val) {
	avalanche_threshhold = parseInt(val);
	document.getElementById("avalancheval").innerHTML = val;
} 

let toggle_shelter = function(val) {
	sheltering = val;
} 

let toggle_avalanche = function(val) {
	avalanching = val;
}

let play = function() {
	document.getElementById("play").innerHTML = "pause";
	playing = true;
}

let pause = function() {
	document.getElementById("play").innerHTML = "play";
	playing = false;
}

let toggle = function() {
	if (playing) {
		pause();
	} else {
		play();
	}
}

let reset = function() {
	pause();
	setup_desert();
}

draw()