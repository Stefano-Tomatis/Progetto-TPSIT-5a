import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { ModuloHttpService } from '../modulo-http.service';
import { Observable } from 'rxjs';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'doctor',
  imports: [DatePipe],
  templateUrl: './doctor.component.html',
  styleUrl: './doctor.component.css'
})
export class DoctorComponent implements OnInit {
  currentOffset: number = 0;
  visite: any[] = [];
  
  settimanaLavorativa: any[][] = [[], [], [], [], []];// lunedì, martedì, mercoledì, giovedì, venerdì

  constructor(private http: ModuloHttpService) { }

  ngOnInit(): void {
    this.aggiornaDatiSettimana(0);
  }

  getWeekTimestamps(offsetSettimane: number = 0) {
    const oggi = new Date();
    const giornoSettimana = oggi.getDay();
    const diffLunedì = oggi.getDate() - giornoSettimana + (giornoSettimana === 0 ? -6 : 1);
    
    const dataLunedi = new Date(oggi.setDate(diffLunedì + (offsetSettimane * 7)));
    dataLunedi.setHours(9, 0, 0, 0);

    const dataVenerdi = new Date(dataLunedi);
    dataVenerdi.setDate(dataLunedi.getDate() + 4);
    dataVenerdi.setHours(17, 0, 0, 0);

    return {
      lunedi: dataLunedi.getTime(),
      venerdi: dataVenerdi.getTime()
    };
  }

  aggiornaDatiSettimana(offset: number) {
    this.currentOffset = offset;
    const { lunedi, venerdi } = this.getWeekTimestamps(this.currentOffset);
    
    this.http.getVisite(lunedi, venerdi).subscribe({
      next: (data) => {
        this.visite = data;
        this.smistaVisite();
      },
      error: (err) => {
        console.error('Errore nel recupero delle visite:', err)
      }
    });
  }

  smistaVisite() {
    // Reset
    this.settimanaLavorativa = [[], [], [], [], []];

    this.visite.forEach(visita => {
      const data = new Date(visita.DataOrario);
      let giorno = data.getDay();      
      if (giorno >= 1 && giorno <= 5) {
        const indiceGiorno = giorno - 1; 
        this.settimanaLavorativa[indiceGiorno].push(visita);
      }
    });
    this.settimanaLavorativa.forEach(giorno => {
      giorno.sort((a, b) => new Date(a.DataOrario).getTime() - new Date(b.DataOrario).getTime());
    });//ordinamento visite per orario
  }

  eventoSettimanaScorsa() {
    this.aggiornaDatiSettimana(this.currentOffset - 1);
  }

  eventoSettimanaProssima() {
    this.aggiornaDatiSettimana(this.currentOffset + 1);
  }

}