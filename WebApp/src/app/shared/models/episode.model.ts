export interface EpisodeRequest {
    title: string;
    filePath: string;
    order: number;
    seriesId: number;
}

export interface EpisodeResponse {
    id: number;
    title: string;
    filePath: string;
    order: number;
    seriesId: number;
}
