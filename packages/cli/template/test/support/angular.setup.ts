// D-105: the Angular test environment for the web specs (`domain/*/web/test/*.spec.ts`), loaded as their
// Vitest setup file. The compiler makes JIT available to SWC-compiled decorators; TestBed runs zoneless.
import '@angular/compiler';
import { NgModule, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

@NgModule({ providers: [provideZonelessChangeDetection()] })
class ZonelessTestingModule {}

getTestBed().initTestEnvironment(
  [BrowserTestingModule, ZonelessTestingModule],
  platformBrowserTesting(),
);
