'use strict';

// ------------------------------------------------------------------------------------------ Dependencies

const del = require('del');
const gulp = require('gulp');
const ts = require('gulp-typescript');
const tslint = require('gulp-tslint');
const sourcemaps = require('gulp-sourcemaps');
const tsProject = ts.createProject('./tsconfig.json');

// ------------------------------------------------------------------------------------------ Tasks

const clean = () => del(['./dist/**/*']);

const lint = () => 	
	gulp.src(['./src/**/*.ts'])
		.pipe(tslint({
			tslint: require('tslint'),
			formatter: "prose"
		}))
		.pipe(tslint.report({
			emitError: true,
			summarizeFailureOutput: true
		}))
		.once("error", function () { this.once("finish", () => process.exit(1)); });

const assets = () => 
	gulp.src(['./src/**/*.json'])
		.pipe(gulp.dest('./dist'));

const compile = () => 
	tsProject.src()
			 .pipe(sourcemaps.init())
			 .pipe(tsProject())
			 .once("error", function () { this.once("finish", () => process.exit(1)); })
			 .pipe(sourcemaps.write())
			 .pipe(gulp.dest('./dist'));

gulp.task('default', gulp.series(clean, lint, assets, compile));
