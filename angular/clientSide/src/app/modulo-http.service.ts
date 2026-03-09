import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModuloHttpService { 
  
  constructor(private http: HttpClient) { }

   loginAsUser(user:any):Observable<any>{
    return this.http.post('http://localhost:3000/session/login/user', user);
  }

   loginAsDoctor(user:any):Observable<any>{
    return this.http.post('http://localhost:3000/session/login/doctor', user);
  }

   loginAsAdmin(user:any):Observable<any>{
    return this.http.post('http://localhost:3000/session/login/admin', user); // da verificare endpoint
  }

  getVisite(dataInizio:any, dataFine:any):Observable<any>{
    //dataInizio = this.toDatabaseDateTime(dataInizio);
    //dataFine = this.toDatabaseDateTime(dataFine);
    return this.http.get(`http://localhost:3000/db/private/visits/externalDoctor?dateStart=${dataInizio}&dateEnd=${dataFine}`);
  }

  getDottori():Observable<any> // id / nome / reparto
  {
    return this.http.get('http://localhost:3000/db/private/getDottori') // chiedi a simo nome rotta giusta
  }

  getOrariDatoDottore(idDoctor:number, data:string):Observable<any>
  {
    return this.http.get(`http://localhost:3000/db/private/orari?id=${idDoctor}`); // chiedi a simo nome rotta giusta
  }


  prenotaVisita(idDottore: number, data: string, ora: string): Observable<any> {
  const payload = { idDottore, data, ora }; 
  return this.http.post('http://localhost:3000/api/prenota', payload);
}

  /*toDatabaseDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }*/
}
